"""AI 시장 일일 브리핑 유즈케이스.

흐름:
1. 오늘 날짜 (YYYY-MM-DD) 캐시 조회 → 있으면 반환 (1일 1회)
2. 매크로 + 인기 종목(거래대금 상위 10) + 메인 뉴스(10) 수집
3. Claude 호출 → JSON 브리핑 생성
4. SQLite 캐시 저장 → 반환

Claude 호출 실패 시 fallback 브리핑 (매크로 risk_summary 기반).
"""

from __future__ import annotations

import logging
from datetime import datetime

from app.domain.entity.market_briefing import MarketBriefing
from app.infrastructure.llm.claude_client import ClaudeClient
from app.infrastructure.macro.macro_repository_impl import FdrMacroRepository
from app.infrastructure.naver.market_news_repository_impl import (
    NaverMarketNewsRepository,
)
from app.infrastructure.naver.market_rank_client import NaverMarketRankClient
from app.infrastructure.naver.sector_client import NaverSectorClient
from app.infrastructure.persistence.market_briefing_repository_impl import (
    SQLiteMarketBriefingRepository,
)

logger = logging.getLogger(__name__)


class MarketBriefingUseCase:
    def __init__(
        self,
        repo: SQLiteMarketBriefingRepository,
        macro_repo: FdrMacroRepository,
        news_repo: NaverMarketNewsRepository,
        rank_client: NaverMarketRankClient,
        claude_client: ClaudeClient,
        sector_client: NaverSectorClient | None = None,
    ) -> None:
        self.repo = repo
        self.macro_repo = macro_repo
        self.news_repo = news_repo
        self.rank_client = rank_client
        self.claude_client = claude_client
        self.sector_client = sector_client

    async def get_briefing(self, force: bool = False) -> MarketBriefing:
        today = datetime.now().strftime("%Y-%m-%d")

        if not force:
            cached = await self.repo.get_by_date(today)
            if cached:
                return cached

        # 1. 매크로
        macro = await self.macro_repo.get_snapshot()
        macro_lines = [
            f"- {ind.label}: {ind.value:,.2f} ({ind.change_pct:+.2f}%)"
            for ind in macro.indicators
        ]
        macro_lines.append(
            f"- 종합 리스크: {macro.risk_level} — {macro.risk_summary}"
        )

        # 2. 인기 종목 (거래대금 KOSPI 상위 10)
        try:
            hot = await self.rank_client.get_hot_stocks(
                metric="value", market="KOSPI", limit=10
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("hot stocks fetch failed for briefing: %s", exc)
            hot = []
        hot_lines = [
            f"- {h.name} ({h.symbol}): {h.price:,.0f}원 ({h.change_pct:+.2f}%)"
            for h in hot
        ]

        # 2-1. 상승률/하락률 Top 5 (KOSPI)
        try:
            risers = await self.rank_client.get_hot_stocks(
                metric="change", market="KOSPI", limit=5
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("risers fetch failed: %s", exc)
            risers = []
        rise_lines = [
            f"- {r.name}: {r.change_pct:+.2f}%" for r in risers
        ]

        try:
            fallers = await self.rank_client.get_hot_stocks(
                metric="fall", market="KOSPI", limit=5
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("fallers fetch failed: %s", exc)
            fallers = []
        fall_lines = [
            f"- {f.name}: {f.change_pct:+.2f}%" for f in fallers
        ]

        # 2-2. 강/약세 섹터 Top 5
        sector_strong_lines: list[str] = []
        sector_weak_lines: list[str] = []
        if self.sector_client is not None:
            try:
                sectors = await self.sector_client.get_sectors()
            except Exception as exc:  # noqa: BLE001
                logger.warning("sectors fetch failed: %s", exc)
                sectors = []
            sector_strong_lines = [
                f"- {s.name}: {s.change_pct:+.2f}% ({s.up_count}↑/{s.down_count}↓)"
                for s in sectors[:5]
            ]
            sector_weak_lines = [
                f"- {s.name}: {s.change_pct:+.2f}% ({s.up_count}↑/{s.down_count}↓)"
                for s in sectors[-5:]
            ]

        # 3. 메인 뉴스 (10건)
        try:
            news = await self.news_repo.fetch(limit=10)
        except Exception as exc:  # noqa: BLE001
            logger.warning("market news fetch failed for briefing: %s", exc)
            news = []
        news_lines = [f"- {n.headline}" for n in news]

        # 4. Claude 호출 (실패 시 fallback)
        try:
            payload = await self.claude_client.generate_market_briefing(
                macro_lines=macro_lines,
                hot_stock_lines=hot_lines,
                news_lines=news_lines,
                rise_lines=rise_lines,
                fall_lines=fall_lines,
                sector_strong_lines=sector_strong_lines,
                sector_weak_lines=sector_weak_lines,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Claude market briefing failed: %s", exc)
            payload = {
                "headline": macro.risk_summary,
                "weather": _risk_to_weather(macro.risk_level),
                "briefing": "AI 브리핑 생성에 실패하여 매크로 요약으로 대체합니다.",
                "sectors_strong": [],
                "sectors_weak": [],
            }

        briefing = MarketBriefing(
            date=today,
            headline=str(payload.get("headline", "")),
            weather=str(payload.get("weather", "흐림")),
            briefing=str(payload.get("briefing", "")),
            sectors_strong=[str(x) for x in payload.get("sectors_strong", [])],
            sectors_weak=[str(x) for x in payload.get("sectors_weak", [])],
            computed_at=datetime.now(),
        )
        await self.repo.save(briefing)
        return briefing


def _risk_to_weather(risk: str) -> str:
    if risk == "high":
        return "비"
    if risk == "mid":
        return "흐림"
    return "맑음"
