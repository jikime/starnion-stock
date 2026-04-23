"""LLMRepository Protocol 구현. ClaudeClient 위임."""

from functools import lru_cache

from app.domain.entity.news import NewsItem
from app.infrastructure.llm.claude_client import ClaudeClient


class LLMRepositoryImpl:
    def __init__(self, client: ClaudeClient) -> None:
        self._client = client

    async def analyze_sentiment(self, news: list[NewsItem]) -> dict:
        return await self._client.analyze_sentiment(news)

    async def generate_briefing(
        self,
        signal_type: str,
        stock_name: str,
        current_price: float,
        target_price: float | None,
        reasons: list[str],
    ) -> str:
        return await self._client.generate_briefing(
            signal_type=signal_type,
            stock_name=stock_name,
            current_price=current_price,
            target_price=target_price,
            reasons=reasons,
        )


@lru_cache(maxsize=1)
def get_llm_repository() -> LLMRepositoryImpl:
    return LLMRepositoryImpl(ClaudeClient())
