from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.market_briefing import MarketBriefing


class MarketBriefingDTO(BaseModel):
    date: str
    headline: str
    weather: str
    briefing: str
    sectors_strong: list[str]
    sectors_weak: list[str]
    computed_at: datetime | None = None

    @classmethod
    def from_entity(cls, e: MarketBriefing) -> "MarketBriefingDTO":
        return cls(
            date=e.date,
            headline=e.headline,
            weather=e.weather,
            briefing=e.briefing,
            sectors_strong=e.sectors_strong,
            sectors_weak=e.sectors_weak,
            computed_at=e.computed_at,
        )
