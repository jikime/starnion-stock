"""AI 타점 종합 판단 유즈케이스 — docs/01 구현.

3가지 매수 타점 로직을 각각 수치 조건식으로 검사하고, docs/01 의 복합
점수제(기술 40 / 수급 30 / 뉴스 20 / 심리 10)로 Final Score 를 산출한다.

매수 타점 조건:
  ① 역추세  : RSI < 30 AND Price < Bollinger_Lower
  ② 추세    : MA5 > MA20 > MA60 AND Price ≤ MA20 × 1.02 (눌림목)
  ③ 세력매수: Price > VWAP AND Volume > 20일평균 × 2

신호 판정:
  - STRONG_BUY : 복합 점수 ≥ 85
  - BUY        : step1(기술) AND step2(뉴스)
  - SELL       : RSI > 75 OR (수급 연속 매도 + 추세 이탈)
  - 그 외      : HOLD
"""

from __future__ import annotations

import logging

from app.domain.entity.indicator import Indicators, Signal
from app.domain.entity.investor_flow import InvestorFlow
from app.domain.entity.macro import MacroSnapshot
from app.domain.repository.news_repository import NewsRepository
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.indicator.calculator import IndicatorCalculator
from app.infrastructure.llm.claude_client import ClaudeClient
from app.infrastructure.macro.macro_repository_impl import FdrMacroRepository
from app.infrastructure.naver.investor_flow_client import (
    NaverInvestorFlowClient,
)
from app.usecase.news_usecase import NewsUseCase

logger = logging.getLogger(__name__)


# docs/01 복합 점수 가중치
W_TECH = 0.40
W_SUPPLY = 0.30
W_NEWS = 0.20
W_PSYCH = 0.10

STRONG_BUY_THRESHOLD = 85


class SignalUseCase:
    def __init__(
        self,
        stock_repo: StockRepository,
        news_repo: NewsRepository,
        news_usecase: NewsUseCase,
        calculator: IndicatorCalculator,
        investor_flow_client: NaverInvestorFlowClient | None = None,
        macro_repo: FdrMacroRepository | None = None,
        claude_client: ClaudeClient | None = None,
    ) -> None:
        self.stock_repo = stock_repo
        self.news_repo = news_repo
        self.news_usecase = news_usecase
        self.calculator = calculator
        self.investor_flow_client = investor_flow_client
        self.macro_repo = macro_repo
        self.claude_client = claude_client

    async def generate_signal(self, symbol: str) -> Signal:
        # 1. 데이터 수집
        candles = await self.stock_repo.get_candles(symbol, count=120)
        indicators = self.calculator.calculate_all(candles)
        news = await self.news_usecase.get_news(symbol, limit=10)
        pos_rate = self.news_usecase.calculate_positive_rate(news)

        flow: InvestorFlow | None = None
        if self.investor_flow_client is not None:
            try:
                flow = await self.investor_flow_client.get_flow(symbol, days=10)
            except Exception:  # noqa: BLE001
                flow = None

        macro: MacroSnapshot | None = None
        if self.macro_repo is not None:
            try:
                macro = await self.macro_repo.get_snapshot()
            except Exception:  # noqa: BLE001
                macro = None

        # 2. 3개 매수 타점 조건 검사
        cond_rsi_bb = _check_rsi_bb(indicators)
        cond_trend_pullback = _check_trend_pullback(indicators, candles)
        cond_vwap_volume = _check_vwap_volume(indicators)

        step1_technical = (
            cond_rsi_bb or cond_trend_pullback or cond_vwap_volume
        )
        step2_sentiment = pos_rate >= 0.7

        # 3. 수급 조건
        cond_supply = False
        if flow and flow.days:
            net_5d = flow.foreign_net_5d + flow.institution_net_5d
            cond_supply = net_5d > 0

        # 4. 복합 점수 산출
        score_tech = _score_technical(
            cond_rsi_bb, cond_trend_pullback, cond_vwap_volume, indicators
        )
        score_supply = _score_supply(flow)
        score_news = int(pos_rate * 100)
        score_psych = _score_psychology(macro)

        final_score = int(
            score_tech * W_TECH
            + score_supply * W_SUPPLY
            + score_news * W_NEWS
            + score_psych * W_PSYCH
        )
        final_score = max(0, min(100, final_score))

        # 5. Signal type 판정
        signal_type = _decide_signal_type(
            final_score=final_score,
            step1=step1_technical,
            step2=step2_sentiment,
            indicators=indicators,
            flow=flow,
        )

        # 6. Reasons 수집
        reasons: list[str] = []
        if cond_rsi_bb and indicators.rsi14 is not None:
            reasons.append(
                f"RSI {indicators.rsi14:.1f} 과매도 + BB 하단 돌파"
            )
        if cond_trend_pullback:
            reasons.append("MA 정배열 + MA20 눌림목 구간")
        if cond_vwap_volume:
            vol_txt = (
                f"{indicators.volume_ratio:.1f}×"
                if indicators.volume_ratio
                else "급증"
            )
            reasons.append(f"VWAP 상회 + 거래량 {vol_txt}")
        if cond_supply and flow:
            net_total = flow.foreign_net_5d + flow.institution_net_5d
            reasons.append(
                f"외인+기관 5일 순매수 {net_total / 1000:+.0f}K"
            )
        if step2_sentiment:
            reasons.append(f"뉴스 긍정 {pos_rate * 100:.0f}%")
        if not reasons:
            reasons.append("관망 — 특이 신호 없음")

        # 7. 목표가 (간이)
        target_price = None
        if candles:
            target_price = candles[-1].close * 1.06

        # 8. AI 자동 컨펌 (docs/01 #4) — STRONG_BUY 에만 Claude 호출
        ai_confirmation: str | None = None
        ai_verdict: str | None = None
        if signal_type == "STRONG_BUY" and self.claude_client is not None:
            try:
                price = await self.stock_repo.get_price(symbol)
                stock_name = price.name if price else symbol
                result = await self.claude_client.confirm_signal(
                    stock_name=stock_name,
                    symbol=symbol,
                    reasons=reasons,
                    news=news,
                )
                ai_verdict = result.get("verdict")
                ai_confirmation = result.get("summary")
                # REJECT 면 시그널 격하
                if ai_verdict == "REJECT":
                    signal_type = "HOLD"
                    reasons.append(f"AI 컨펌 REJECT: {ai_confirmation}")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Claude signal confirm failed: %s", exc)

        return Signal(
            symbol=symbol,
            type=signal_type,
            confidence=final_score,
            momentum=final_score,
            step1_technical=step1_technical,
            step2_sentiment=step2_sentiment,
            cond_rsi_bb=cond_rsi_bb,
            cond_trend_pullback=cond_trend_pullback,
            cond_vwap_volume=cond_vwap_volume,
            cond_supply=cond_supply,
            score_tech=score_tech,
            score_supply=score_supply,
            score_news=score_news,
            score_psych=score_psych,
            target_price=target_price,
            reasons=reasons,
            ai_confirmation=ai_confirmation,
            ai_verdict=ai_verdict,
        )

    async def get_momentum(self, symbol: str) -> int:
        signal = await self.generate_signal(symbol)
        return signal.momentum


# ─── 타점 조건 검사 ──────────────────────────────────────────────────────


def _check_rsi_bb(ind: Indicators) -> bool:
    """① 역추세: RSI<30 AND Price<BB_Lower."""

    if (
        ind.rsi14 is None
        or ind.bb_lower is None
        or ind.close_price is None
    ):
        return False
    return ind.rsi14 < 30 and ind.close_price < ind.bb_lower


def _check_trend_pullback(ind: Indicators, candles: list) -> bool:
    """② 추세 매수 (docs/01) — 정배열 + MA20 상승 기울기 + cross-down 눌림목.

    조건:
      (a) 이평선 정배열: MA5 > MA20 > MA60
      (b) MA20 기울기 양수 (상승 추세 유지) — 최근 5봉 선형 기울기
      (c) Cross-down 눌림목 이벤트: 최근 3~7봉 내에서 close 가 MA20 위에
          있다가 지금은 MA20 의 -3% ~ +1% 근접 구간으로 내려왔음

    과거 단순 '0.97~1.02 범위 근접' 만 보던 것을 '상단에서 하단으로의
    전환' 이벤트로 정확히 감지.
    """

    if (
        ind.sma5 is None
        or ind.sma20 is None
        or ind.sma60 is None
        or ind.close_price is None
    ):
        return False

    # (a) 정배열
    if not (ind.sma5 > ind.sma20 > ind.sma60):
        return False

    # (b) MA20 기울기 — 최근 5봉 close 로 근사 SMA 재계산 후 slope
    if len(candles) < 25:
        return False
    recent_sma20_now = ind.sma20
    closes_minus5 = [c.close for c in candles[-25:-5]]
    if len(closes_minus5) < 20:
        return False
    recent_sma20_5ago = sum(closes_minus5) / 20
    slope = recent_sma20_now - recent_sma20_5ago
    if slope <= 0:  # 하락/평탄한 MA20 이면 매수 보류
        return False

    # (c) Cross-down 전이 — 최근 3~7봉 중 최소 1봉은 close > MA20 × 1.02
    #     이어야 "상단에 있다가 내려온" 이벤트로 간주
    lookback = candles[-7:-1] if len(candles) >= 8 else candles[:-1]
    if not lookback:
        return False
    was_above = any(
        c.close > ind.sma20 * 1.02 for c in lookback
    )
    now_near_or_below = (
        ind.sma20 * 0.97 <= ind.close_price <= ind.sma20 * 1.01
    )
    return was_above and now_near_or_below


def _check_vwap_volume(ind: Indicators) -> bool:
    """③ 세력매수: Price>VWAP AND Volume>Avg*2."""

    if (
        ind.vwap is None
        or ind.close_price is None
        or ind.volume_ratio is None
    ):
        return False
    return ind.close_price > ind.vwap and ind.volume_ratio >= 2.0


# ─── 복합 점수 ──────────────────────────────────────────────────────────


def _score_technical(
    rsi_bb: bool,
    trend: bool,
    vwap_vol: bool,
    ind: Indicators,
) -> int:
    """3개 타점 충족 수(각 30점) + MACD 골든크로스 보정 10점."""

    base = 0
    if rsi_bb:
        base += 30
    if trend:
        base += 30
    if vwap_vol:
        base += 30
    if (
        ind.macd is not None
        and ind.macd_signal is not None
        and ind.macd > ind.macd_signal
    ):
        base += 10
    return max(0, min(100, base))


def _score_supply(flow: InvestorFlow | None) -> int:
    """외인+기관 5일 누적 순매수 / 총 거래량 비율 기반 점수."""

    if flow is None or not flow.days:
        return 50

    net_5d = flow.foreign_net_5d + flow.institution_net_5d
    total_vol = sum(d.volume for d in flow.days[:5]) or 1
    ratio = net_5d / total_vol  # -1 ~ +1 근사

    base = 50 + ratio * 400
    base += min(flow.foreign_net_streak, 5) * 3
    return max(0, min(100, int(base)))


def _score_psychology(macro: MacroSnapshot | None) -> int:
    """매크로 risk_level 기반 심리 점수."""

    if macro is None:
        return 50
    if macro.risk_level == "low":
        return 80
    if macro.risk_level == "mid":
        return 50
    return 25


# ─── 최종 판정 ──────────────────────────────────────────────────────────


def _decide_signal_type(
    final_score: int,
    step1: bool,
    step2: bool,
    indicators: Indicators,
    flow: InvestorFlow | None,
) -> str:
    if indicators.rsi14 is not None and indicators.rsi14 > 75:
        return "SELL"
    if (
        flow
        and flow.days
        and flow.foreign_net_5d < 0
        and indicators.sma20
        and indicators.close_price
        and indicators.close_price < indicators.sma20 * 0.97
    ):
        return "SELL"

    if final_score >= STRONG_BUY_THRESHOLD:
        return "STRONG_BUY"

    if step1 and step2:
        return "BUY"

    return "HOLD"
