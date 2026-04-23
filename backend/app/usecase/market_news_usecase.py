"""시장 메인 뉴스 유즈케이스."""

from __future__ import annotations

from app.domain.entity.market_news import MarketNewsItem
from app.infrastructure.naver.market_news_repository_impl import (
    NaverMarketNewsRepository,
)


class MarketNewsUseCase:
    def __init__(self, repo: NaverMarketNewsRepository) -> None:
        self.repo = repo

    async def get_news(self, limit: int = 20) -> list[MarketNewsItem]:
        return await self.repo.fetch(limit=limit)
