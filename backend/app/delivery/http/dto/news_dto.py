from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.news import (
    NewsItem,
    Sentiment,
    SentimentHeatmapBin,
    TrendingKeyword,
)


class NewsItemDTO(BaseModel):
    id: str
    symbol: str
    headline: str
    source: str
    url: str
    sentiment: Sentiment
    impact: str
    keywords: list[str]
    ai_summary: str
    published_at: datetime | None = None
    hour: int

    @classmethod
    def from_entity(cls, entity: NewsItem) -> "NewsItemDTO":
        return cls(
            id=entity.id,
            symbol=entity.symbol,
            headline=entity.headline,
            source=entity.source,
            url=entity.url,
            sentiment=entity.sentiment,
            impact=entity.impact,
            keywords=entity.keywords,
            ai_summary=entity.ai_summary,
            published_at=entity.published_at,
            hour=entity.hour,
        )


class SentimentHeatmapBinDTO(BaseModel):
    hour: int
    positive: int
    negative: int
    neutral: int

    @classmethod
    def from_entity(cls, entity: SentimentHeatmapBin) -> "SentimentHeatmapBinDTO":
        return cls(
            hour=entity.hour,
            positive=entity.positive,
            negative=entity.negative,
            neutral=entity.neutral,
        )


class TrendingKeywordDTO(BaseModel):
    text: str
    weight: str
    sentiment: Sentiment

    @classmethod
    def from_entity(cls, entity: TrendingKeyword) -> "TrendingKeywordDTO":
        return cls(
            text=entity.text,
            weight=entity.weight,
            sentiment=entity.sentiment,
        )
