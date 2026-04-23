from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.ai_analysis import AIAnalysis


class AIAnalysisDTO(BaseModel):
    id: str
    symbol: str
    stock_name: str
    decision: str
    confidence: int
    summary: str
    reasoning: str
    positives: list[str]
    risks: list[str]
    target_price: float | None = None
    rsi: float | None = None
    macd_state: str | None = None
    news_count: int
    price_at_analysis: float | None = None
    created_at: datetime | None = None

    @classmethod
    def from_entity(cls, entity: AIAnalysis) -> "AIAnalysisDTO":
        return cls(
            id=entity.id,
            symbol=entity.symbol,
            stock_name=entity.stock_name,
            decision=entity.decision,
            confidence=entity.confidence,
            summary=entity.summary,
            reasoning=entity.reasoning,
            positives=entity.positives,
            risks=entity.risks,
            target_price=entity.target_price,
            rsi=entity.rsi,
            macd_state=entity.macd_state,
            news_count=entity.news_count,
            price_at_analysis=entity.price_at_analysis,
            created_at=entity.created_at,
        )
