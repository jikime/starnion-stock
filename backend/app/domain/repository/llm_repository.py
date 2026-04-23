from typing import Protocol

from app.domain.entity.news import NewsItem


class LLMRepository(Protocol):
    async def analyze_sentiment(self, news: list[NewsItem]) -> dict:
        """뉴스 리스트를 입력받아 종합 감성 분석 결과를 반환한다.

        Returns:
            dict: {
                "sentiment": "positive" | "negative" | "neutral",
                "summary": str,
                "key_issues": str,
                "risk_factors": str,
                "investment_implication": str,
            }
        """
        ...

    async def generate_briefing(
        self,
        signal_type: str,
        stock_name: str,
        current_price: float,
        target_price: float | None,
        reasons: list[str],
    ) -> str:
        """신호와 컨텍스트를 받아 한국어 브리핑 문장을 생성한다."""
        ...
