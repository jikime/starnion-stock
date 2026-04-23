from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.market_news import MarketNewsItem


class MarketNewsItemDTO(BaseModel):
    id: str
    headline: str
    url: str
    summary: str
    press: str
    image_url: str
    published_at: datetime | None = None

    @classmethod
    def from_entity(cls, entity: MarketNewsItem) -> "MarketNewsItemDTO":
        return cls(
            id=entity.id,
            headline=entity.headline,
            url=entity.url,
            summary=entity.summary,
            press=entity.press,
            image_url=entity.image_url,
            published_at=entity.published_at,
        )
