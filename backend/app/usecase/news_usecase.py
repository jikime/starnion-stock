"""News 유즈케이스. 뉴스 크롤링 + 감성 분류 + 히트맵 집계."""

from __future__ import annotations

from collections import Counter, defaultdict

from app.domain.entity.news import (
    NewsItem,
    Sentiment,
    SentimentHeatmapBin,
    TrendingKeyword,
)
from app.domain.repository.news_repository import NewsRepository
from app.domain.repository.llm_repository import LLMRepository
from app.infrastructure.sentiment.keyword_scorer import (
    extract_keywords,
    score_sentiment,
)


def _impact_for(score: float) -> str:
    abs_score = abs(score)
    if abs_score >= 0.75:
        return "Critical"
    if abs_score >= 0.45:
        return "High"
    return "Moderate"


class NewsUseCase:
    def __init__(
        self,
        news_repo: NewsRepository,
        llm_repo: LLMRepository,
    ) -> None:
        self.news_repo = news_repo
        self.llm_repo = llm_repo

    async def get_news(self, symbol: str, limit: int = 10) -> list[NewsItem]:
        """뉴스를 가져오고 키워드 기반 1차 감성 분류를 적용."""

        items = await self.news_repo.fetch_by_symbol(symbol, limit=limit)
        for item in items:
            sentiment, score = score_sentiment(item.headline)
            item.sentiment = sentiment
            item.impact = _impact_for(score)
            item.keywords = extract_keywords(item.headline)
        return items

    async def get_news_with_ai_summary(
        self, symbol: str, limit: int = 10
    ) -> tuple[list[NewsItem], dict]:
        """뉴스 + LLM 종합 분석 (트리거 조건에서만 사용)."""

        items = await self.get_news(symbol, limit)
        if not items:
            return items, {}
        ai_summary = await self.llm_repo.analyze_sentiment(items)
        summary_text = ai_summary.get("summary", "")
        for item in items:
            if not item.ai_summary:
                item.ai_summary = summary_text
        return items, ai_summary

    async def get_sentiment_heatmap(
        self, symbol: str, limit: int = 30
    ) -> list[SentimentHeatmapBin]:
        """24시간 감성 히트맵 (시간대별 집계)."""

        items = await self.get_news(symbol, limit=limit)
        bins: dict[int, dict[str, int]] = defaultdict(
            lambda: {"pos": 0, "neg": 0, "neu": 0}
        )
        for item in items:
            bins[item.hour][item.sentiment.value] += 1

        result: list[SentimentHeatmapBin] = []
        for hour in range(24):
            counts = bins.get(hour, {"pos": 0, "neg": 0, "neu": 0})
            result.append(
                SentimentHeatmapBin(
                    hour=hour,
                    positive=counts["pos"],
                    negative=counts["neg"],
                    neutral=counts["neu"],
                )
            )
        return result

    async def get_trending_keywords(
        self, symbol: str, limit: int = 12
    ) -> list[TrendingKeyword]:
        items = await self.get_news(symbol, limit=20)
        counter: Counter = Counter()
        sentiment_map: dict[str, Sentiment] = {}
        for item in items:
            for kw in item.keywords:
                counter[kw] += 1
                sentiment_map[kw] = item.sentiment

        most_common = counter.most_common(limit)
        if not most_common:
            return []

        max_count = most_common[0][1]
        result: list[TrendingKeyword] = []
        for kw, count in most_common:
            ratio = count / max_count
            if ratio >= 0.7:
                weight = "high"
            elif ratio >= 0.4:
                weight = "mid"
            else:
                weight = "low"
            result.append(
                TrendingKeyword(
                    text=kw,
                    weight=weight,
                    sentiment=sentiment_map.get(kw, Sentiment.NEUTRAL),
                )
            )
        return result

    def calculate_positive_rate(self, items: list[NewsItem]) -> float:
        if not items:
            return 0.0
        pos_count = sum(1 for i in items if i.sentiment == Sentiment.POSITIVE)
        return pos_count / len(items)
