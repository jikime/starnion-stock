"""AI 심층 분석 유즈케이스.

사용자가 UI 에서 "Claude 심층 분석" 버튼을 클릭할 때 호출된다.
기술적 지표 + 뉴스 + 공시를 수집해 Claude 에게 JSON 형식으로 투자 의견을
요청하고, 결과를 DB 에 히스토리로 저장한다.
"""

from __future__ import annotations

import logging
from datetime import datetime

from app.domain.entity.ai_analysis import AIAnalysis
from app.domain.entity.indicator import Indicators
from app.domain.repository.ai_analysis_repository import AIAnalysisRepository
from app.domain.repository.disclosure_repository import DisclosureRepository
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.indicator.calculator import IndicatorCalculator
from app.infrastructure.llm.claude_client import ClaudeClient
from app.usecase.news_usecase import NewsUseCase

logger = logging.getLogger(__name__)


class AIAnalysisUseCase:
    def __init__(
        self,
        repo: AIAnalysisRepository,
        stock_repo: StockRepository,
        disclosure_repo: DisclosureRepository,
        news_usecase: NewsUseCase,
        claude_client: ClaudeClient,
        indicator_calc: IndicatorCalculator,
    ) -> None:
        self.repo = repo
        self.stock_repo = stock_repo
        self.disclosure_repo = disclosure_repo
        self.news_usecase = news_usecase
        self.claude_client = claude_client
        self.indicator_calc = indicator_calc

    async def generate(self, symbol: str) -> AIAnalysis:
        """Claude 에게 심층 분석을 요청하고 결과를 DB 에 저장."""

        # 1. 시장 데이터 수집
        candles = await self.stock_repo.get_candles(symbol, "day", 60)
        indicators = self.indicator_calc.calculate_all(candles)

        price = await self.stock_repo.get_price(symbol)
        if price is None:
            stock_name = symbol
            current_price = candles[-1].close if candles else 0.0
        else:
            stock_name = price.name
            current_price = price.current_price

        news = await self.news_usecase.get_news(symbol, limit=15)

        try:
            disclosures = await self.disclosure_repo.list_recent(symbol, days=30)
        except Exception as exc:  # noqa: BLE001
            logger.warning("disclosure fetch failed for %s: %s", symbol, exc)
            disclosures = []

        # 2. Claude 호출 → JSON 파싱
        raw = await self.claude_client.analyze_trade(
            stock_name=stock_name,
            symbol=symbol,
            current_price=current_price,
            indicators=indicators,
            news=news,
            disclosures=disclosures,
        )

        # 3. 엔티티 조립
        analysis = AIAnalysis(
            id="",  # SQLite repo 에서 UUID 생성
            symbol=symbol,
            stock_name=stock_name,
            decision=str(raw.get("decision", "HOLD")),
            confidence=int(raw.get("confidence", 0)),
            summary=str(raw.get("summary", "")),
            reasoning=str(raw.get("reasoning", "")),
            positives=list(raw.get("positives", [])),
            risks=list(raw.get("risks", [])),
            target_price=raw.get("target_price"),
            rsi=indicators.rsi14,
            macd_state=_macd_state(indicators),
            news_count=len(news),
            price_at_analysis=current_price,
            created_at=datetime.now(),
        )

        # 4. DB 저장
        return await self.repo.create(analysis)

    async def list_history(
        self, symbol: str, limit: int = 20
    ) -> list[AIAnalysis]:
        return await self.repo.list_by_symbol(symbol, limit)

    async def delete(self, analysis_id: str) -> bool:
        return await self.repo.delete(analysis_id)


def _macd_state(indicators: Indicators) -> str | None:
    if indicators.macd is None or indicators.macd_signal is None:
        return None
    diff = indicators.macd - indicators.macd_signal
    if diff > 0.1:
        return "golden"
    if diff < -0.1:
        return "dead"
    return "neutral"
