from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class Sentiment(str, Enum):
    POSITIVE = "pos"
    NEGATIVE = "neg"
    NEUTRAL = "neu"


@dataclass
class NewsItem:
    id: str
    symbol: str
    headline: str
    source: str
    url: str
    sentiment: Sentiment = Sentiment.NEUTRAL
    impact: str = "Moderate"  # "Critical" | "High" | "Moderate"
    keywords: list[str] = field(default_factory=list)
    ai_summary: str = ""
    published_at: datetime | None = None
    hour: int = 0  # 0~23 for heatmap aggregation


@dataclass
class SentimentHeatmapBin:
    hour: int
    positive: int
    negative: int
    neutral: int


@dataclass
class TrendingKeyword:
    text: str
    weight: str  # "high" | "mid" | "low"
    sentiment: Sentiment
