"""Claude Code CLI 구독을 활용한 LLM 클라이언트.

``claude-agent-sdk`` 가 Claude Code CLI 를 subprocess 로 호출하며, 로컬에
로그인된 세션(구독 또는 API 키)을 그대로 사용한다.
"""

from __future__ import annotations

import json
import logging
import re

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    TextBlock,
    query,
)

from app.domain.entity.disclosure import Disclosure
from app.domain.entity.indicator import Indicators
from app.domain.entity.news import NewsItem
from app.infrastructure.indicator.level_detector import DetectedLevel
from app.infrastructure.llm.prompts import (
    BRIEFING_PROMPT,
    LEVEL_EXPLAIN_PROMPT,
    MARKET_BRIEFING_PROMPT,
    NEWS_SENTIMENT_PROMPT,
    SIGNAL_CONFIRM_PROMPT,
    TRADE_ANALYSIS_PROMPT,
)

logger = logging.getLogger(__name__)


def _options(system: str | None = None) -> ClaudeAgentOptions:
    """호출별 옵션 생성 — system_prompt 분리로 prompt caching 활용 (B5)."""

    return ClaudeAgentOptions(
        max_turns=1,
        allowed_tools=[],
        system_prompt=system,
    )


class ClaudeClient:
    """``claude-agent-sdk`` 래퍼. 순수 텍스트 응답만 수집한다.

    B5 Prompt Caching:
      - 각 메서드의 고정 지시문(프롬프트 템플릿)은 ``system`` 인자로 분리
      - 동적 컨텍스트만 ``user_msg`` 로 전달
      - Claude Agent SDK 가 system prompt 부분을 자동 캐싱 → 토큰 비용 90% 절감
    """

    async def _stream_text(
        self, user_msg: str, system: str | None = None
    ) -> str:
        result_chunks: list[str] = []
        try:
            async for msg in query(
                prompt=user_msg, options=_options(system=system)
            ):
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            result_chunks.append(block.text)
        except Exception as exc:  # noqa: BLE001
            logger.warning("claude-agent-sdk query failed: %s", exc)
        return "".join(result_chunks).strip()

    async def analyze_sentiment(self, news: list[NewsItem]) -> dict:
        if not news:
            return _empty_sentiment()

        news_block = "\n".join(
            f"- {n.headline}" + (f" ({n.source})" if n.source else "")
            for n in news
        )

        raw = await self._stream_text(news_block, system=NEWS_SENTIMENT_PROMPT)
        return _parse_sentiment_json(raw)

    async def analyze_trade(
        self,
        stock_name: str,
        symbol: str,
        current_price: float,
        indicators: Indicators,
        news: list[NewsItem],
        disclosures: list[Disclosure],
    ) -> dict:
        """Claude 에게 지표+뉴스+공시를 종합 분석시켜 구조화된 투자 의견을 얻는다.

        반환 dict 키:
          decision, target_price, confidence, summary, positives, risks, reasoning
        """

        # ── 기술적 지표 요약 ─────────────────────────────
        tech_lines = [f"- 현재가: {int(current_price):,}원"]
        if indicators.rsi14 is not None:
            tech_lines.append(
                f"- RSI(14): {indicators.rsi14:.1f} "
                f"({'과매도' if indicators.rsi14 < 30 else '과매수' if indicators.rsi14 > 70 else '중립'})"
            )
        if (
            indicators.macd is not None
            and indicators.macd_signal is not None
        ):
            cross = (
                "골든크로스"
                if indicators.macd > indicators.macd_signal
                else "데드크로스"
            )
            tech_lines.append(
                f"- MACD: {indicators.macd:.0f} / Signal {indicators.macd_signal:.0f} ({cross})"
            )
        if (
            indicators.sma5 is not None
            and indicators.sma20 is not None
            and indicators.sma60 is not None
        ):
            aligned = (
                indicators.sma5 > indicators.sma20 > indicators.sma60
            )
            tech_lines.append(
                f"- 이평선 MA5/MA20/MA60: "
                f"{indicators.sma5:.0f}/{indicators.sma20:.0f}/{indicators.sma60:.0f} "
                f"({'정배열' if aligned else '혼조'})"
            )
        if (
            indicators.bb_upper is not None
            and indicators.bb_lower is not None
        ):
            tech_lines.append(
                f"- Bollinger Band: 상단 {indicators.bb_upper:.0f} / 하단 {indicators.bb_lower:.0f}"
            )
        if indicators.stoch_k is not None:
            tech_lines.append(f"- Stochastic %K: {indicators.stoch_k:.1f}")

        # ── 뉴스 요약 ────────────────────────────────
        news_lines = []
        for n in news[:15]:
            tag = (
                "[호재]"
                if n.sentiment.value == "pos"
                else "[악재]"
                if n.sentiment.value == "neg"
                else "[중립]"
            )
            news_lines.append(f"- {tag} {n.headline} ({n.source})")
        news_block = "\n".join(news_lines) if news_lines else "- (뉴스 없음)"

        # ── DART 공시 요약 ───────────────────────────
        disclosure_lines = []
        for d in disclosures[:5]:
            disclosure_lines.append(
                f"- [{d.category}] {d.report_nm} ({d.rcept_dt})"
            )
        disclosure_block = (
            "\n".join(disclosure_lines) if disclosure_lines else "- (최근 공시 없음)"
        )

        context = (
            f"종목: {stock_name} ({symbol})\n\n"
            f"【기술적 지표】\n" + "\n".join(tech_lines) + "\n\n"
            f"【최근 뉴스】\n" + news_block + "\n\n"
            f"【DART 공시】\n" + disclosure_block
        )

        raw = await self._stream_text(context, system=TRADE_ANALYSIS_PROMPT)
        return _parse_analysis_json(raw)

    async def confirm_signal(
        self,
        stock_name: str,
        symbol: str,
        reasons: list[str],
        news: list[NewsItem],
    ) -> dict:
        """STRONG_BUY 시그널의 최종 컨펌 — 뉴스에 악재 있는지 체크.

        반환 dict: ``verdict`` (CONFIRM/CAUTION/REJECT), ``summary`` (한 문장).
        실패 시 CAUTION + 기본 메시지.
        """

        reason_lines = "\n".join(f"- {r}" for r in reasons) or "- (근거 없음)"
        news_lines = []
        for n in news[:10]:
            tag = (
                "[호재]"
                if n.sentiment.value == "pos"
                else "[악재]"
                if n.sentiment.value == "neg"
                else "[중립]"
            )
            news_lines.append(f"- {tag} {n.headline}")
        news_block = "\n".join(news_lines) if news_lines else "- (최근 뉴스 없음)"

        context = (
            f"종목: {stock_name} ({symbol})\n\n"
            f"【매수 시그널 근거】\n{reason_lines}\n\n"
            f"【최근 뉴스】\n{news_block}"
        )
        raw = await self._stream_text(context, system=SIGNAL_CONFIRM_PROMPT)
        return _parse_confirm_json(raw)

    async def explain_levels(
        self,
        stock_name: str,
        symbol: str,
        current_price: float,
        levels: list[DetectedLevel],
        news: list[NewsItem],
    ) -> dict[float, str]:
        """후보 레벨들에 대해 Claude 가 한 문장 해설을 생성.

        반환: ``{price: explanation}`` 매핑. 파싱 실패 시 빈 dict.
        LLM 호출 실패가 전체 요청을 막으면 안 되므로 예외는 내부에서 삼킨다.
        """

        if not levels:
            return {}

        level_lines = []
        for lv in levels:
            dist_pct = (lv.price - current_price) / current_price * 100
            kind_ko = "저항" if lv.kind == "resistance" else "지지"
            level_lines.append(
                f"- {kind_ko} {int(lv.price):,}원 "
                f"(현재가 대비 {dist_pct:+.1f}%, 터치 {lv.touch_count}회, "
                f"strength {lv.strength}/100)"
            )

        news_lines = []
        for n in news[:8]:
            tag = (
                "[호재]"
                if n.sentiment.value == "pos"
                else "[악재]"
                if n.sentiment.value == "neg"
                else "[중립]"
            )
            news_lines.append(f"- {tag} {n.headline}")
        news_block = (
            "\n".join(news_lines) if news_lines else "- (최근 뉴스 없음)"
        )

        context = (
            f"종목: {stock_name} ({symbol})\n"
            f"현재가: {int(current_price):,}원\n\n"
            f"【후보 레벨】\n" + "\n".join(level_lines) + "\n\n"
            f"【최근 뉴스】\n" + news_block
        )
        raw = await self._stream_text(context, system=LEVEL_EXPLAIN_PROMPT)
        return _parse_level_explanations(raw)

    async def generate_market_briefing(
        self,
        macro_lines: list[str],
        hot_stock_lines: list[str],
        news_lines: list[str],
        rise_lines: list[str] | None = None,
        fall_lines: list[str] | None = None,
        sector_strong_lines: list[str] | None = None,
        sector_weak_lines: list[str] | None = None,
    ) -> dict:
        """오늘의 시장 일일 브리핑 생성 — JSON 응답.

        반환 dict 키: ``headline``, ``weather``, ``briefing``,
        ``sectors_strong``, ``sectors_weak``.
        """

        def _block(lines: list[str] | None, empty: str) -> str:
            return "\n".join(lines) if lines else empty

        macro_block = _block(macro_lines, "- (매크로 데이터 없음)")
        hot_block = _block(hot_stock_lines, "- (인기 종목 없음)")
        news_block = _block(news_lines, "- (메인 뉴스 없음)")
        rise_block = _block(rise_lines, "- (상승률 데이터 없음)")
        fall_block = _block(fall_lines, "- (하락률 데이터 없음)")
        sector_strong_block = _block(
            sector_strong_lines, "- (섹터 상위 데이터 없음)"
        )
        sector_weak_block = _block(
            sector_weak_lines, "- (섹터 하위 데이터 없음)"
        )

        context = (
            "【거시경제】\n"
            + macro_block
            + "\n\n【인기 종목 (거래대금 TOP10)】\n"
            + hot_block
            + "\n\n【상승률 TOP5】\n"
            + rise_block
            + "\n\n【하락률 TOP5】\n"
            + fall_block
            + "\n\n【강세 섹터 TOP5】\n"
            + sector_strong_block
            + "\n\n【약세 섹터 TOP5】\n"
            + sector_weak_block
            + "\n\n【메인 뉴스】\n"
            + news_block
        )
        raw = await self._stream_text(context, system=MARKET_BRIEFING_PROMPT)
        return _parse_market_briefing_json(raw)

    async def generate_briefing(
        self,
        signal_type: str,
        stock_name: str,
        current_price: float,
        target_price: float | None,
        reasons: list[str],
    ) -> str:
        context = (
            f"시그널 타입: {signal_type}\n"
            f"종목명: {stock_name}\n"
            f"현재가: {int(current_price):,}원\n"
            f"목표가: {int(target_price):,}원"
            if target_price
            else f"시그널 타입: {signal_type}\n종목명: {stock_name}\n현재가: {int(current_price):,}원"
        )
        if reasons:
            context += "\n주요 근거: " + ", ".join(reasons)

        text = await self._stream_text(context, system=BRIEFING_PROMPT)
        # 여러 줄/따옴표 제거
        cleaned = text.strip().strip('"').splitlines()
        return cleaned[0] if cleaned else ""


# ── helpers ──────────────────────────────────────────────────────────────


def _empty_sentiment() -> dict:
    return {
        "sentiment": "neutral",
        "summary": "",
        "key_issues": "",
        "risk_factors": "",
        "investment_implication": "",
    }


def _parse_sentiment_json(raw: str) -> dict:
    """LLM 응답에서 JSON 객체를 안전하게 추출."""

    if not raw:
        return _empty_sentiment()

    # 마크다운 코드블럭 제거
    cleaned = re.sub(r"```(?:json)?", "", raw).strip("` \n")

    # 첫 { 부터 마지막 } 까지를 jsonload 시도
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        payload = cleaned[start:end]
        data = json.loads(payload)
        return {
            "sentiment": str(data.get("sentiment", "neutral")),
            "summary": str(data.get("summary", "")),
            "key_issues": str(data.get("key_issues", "")),
            "risk_factors": str(data.get("risk_factors", "")),
            "investment_implication": str(data.get("investment_implication", "")),
        }
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Failed to parse sentiment JSON: %s", exc)
        return _empty_sentiment()


def _empty_analysis() -> dict:
    return {
        "decision": "HOLD",
        "target_price": None,
        "confidence": 0,
        "summary": "분석을 생성하지 못했습니다.",
        "positives": [],
        "risks": [],
        "reasoning": "LLM 응답 오류로 판정 불가. 다시 시도해주세요.",
    }


def _parse_analysis_json(raw: str) -> dict:
    """Claude TRADE_ANALYSIS 응답을 구조화된 dict 로 파싱."""

    if not raw:
        return _empty_analysis()

    cleaned = re.sub(r"```(?:json)?", "", raw).strip("` \n")

    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        data = json.loads(cleaned[start:end])
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Failed to parse trade analysis JSON: %s", exc)
        return _empty_analysis()

    decision = str(data.get("decision", "HOLD")).upper()
    if decision not in ("BUY", "SELL", "HOLD"):
        decision = "HOLD"

    target_raw = data.get("target_price")
    try:
        target_price = (
            float(target_raw) if target_raw not in (None, "", "null") else None
        )
    except (ValueError, TypeError):
        target_price = None

    try:
        confidence = int(data.get("confidence", 0))
    except (ValueError, TypeError):
        confidence = 0
    confidence = max(0, min(100, confidence))

    def _str_list(key: str) -> list[str]:
        value = data.get(key, [])
        if isinstance(value, list):
            return [str(x) for x in value if x]
        if isinstance(value, str):
            return [line.strip("-• ").strip() for line in value.splitlines() if line.strip()]
        return []

    return {
        "decision": decision,
        "target_price": target_price,
        "confidence": confidence,
        "summary": str(data.get("summary", "")),
        "positives": _str_list("positives"),
        "risks": _str_list("risks"),
        "reasoning": str(data.get("reasoning", "")),
    }


def _empty_market_briefing() -> dict:
    return {
        "headline": "오늘의 시장 브리핑을 생성하지 못했습니다.",
        "weather": "흐림",
        "briefing": "LLM 응답 오류로 브리핑을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.",
        "sectors_strong": [],
        "sectors_weak": [],
    }


def _parse_market_briefing_json(raw: str) -> dict:
    """Claude MARKET_BRIEFING 응답 파싱."""

    if not raw:
        return _empty_market_briefing()

    cleaned = re.sub(r"```(?:json)?", "", raw).strip("` \n")
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        data = json.loads(cleaned[start:end])
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Failed to parse market briefing JSON: %s", exc)
        return _empty_market_briefing()

    weather = str(data.get("weather", "흐림"))
    if weather not in ("맑음", "흐림", "비"):
        weather = "흐림"

    def _str_list(key: str) -> list[str]:
        v = data.get(key, [])
        if isinstance(v, list):
            return [str(x) for x in v if x]
        return []

    return {
        "headline": str(data.get("headline", "")),
        "weather": weather,
        "briefing": str(data.get("briefing", "")),
        "sectors_strong": _str_list("sectors_strong"),
        "sectors_weak": _str_list("sectors_weak"),
    }


def _parse_confirm_json(raw: str) -> dict:
    """Claude SIGNAL_CONFIRM 응답 파싱 → {verdict, summary}."""

    default = {"verdict": "CAUTION", "summary": "AI 컨펌 파싱 실패"}
    if not raw:
        return default
    cleaned = re.sub(r"```(?:json)?", "", raw).strip("` \n")
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        data = json.loads(cleaned[start:end])
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Failed to parse confirm JSON: %s", exc)
        return default

    verdict = str(data.get("verdict", "CAUTION")).upper()
    if verdict not in ("CONFIRM", "CAUTION", "REJECT"):
        verdict = "CAUTION"
    summary = str(data.get("summary", "")).strip() or default["summary"]
    return {"verdict": verdict, "summary": summary}


def _parse_level_explanations(raw: str) -> dict[float, str]:
    """Claude LEVEL_EXPLAIN 응답에서 ``{price: explanation}`` 매핑 추출.

    파싱이 실패하면 빈 dict — LevelUseCase 에서 알고리즘 결과만으로
    degrade gracefully 한다.
    """

    if not raw:
        return {}

    cleaned = re.sub(r"```(?:json)?", "", raw).strip("` \n")
    try:
        start = cleaned.index("{")
        end = cleaned.rindex("}") + 1
        data = json.loads(cleaned[start:end])
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("Failed to parse level explanation JSON: %s", exc)
        return {}

    items = data.get("explanations", [])
    if not isinstance(items, list):
        return {}

    result: dict[float, str] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        price_raw = item.get("price")
        if price_raw is None:
            continue
        try:
            price = float(price_raw)
        except (ValueError, TypeError):
            continue
        explanation = str(item.get("explanation", "")).strip()
        if explanation:
            result[round(price, 2)] = explanation
    return result
