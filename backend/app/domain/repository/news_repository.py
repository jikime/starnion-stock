from typing import Protocol

from app.domain.entity.news import NewsItem


class NewsRepository(Protocol):
    async def fetch_by_symbol(self, symbol: str, limit: int = 10) -> list[NewsItem]: ...
