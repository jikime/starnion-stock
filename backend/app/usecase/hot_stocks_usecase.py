"""인기 종목 랭킹 유즈케이스 — NaverMarketRankClient 패스스루."""

from __future__ import annotations

from app.infrastructure.naver.market_rank_client import (
    HotStockRow,
    NaverMarketRankClient,
)


VALID_METRICS = {"value", "volume", "change", "fall"}


class HotStocksUseCase:
    def __init__(self, naver_client: NaverMarketRankClient) -> None:
        self.naver_client = naver_client

    async def get_hot_stocks(
        self, metric: str, market: str = "KOSPI", limit: int = 20
    ) -> list[HotStockRow]:
        if metric not in VALID_METRICS:
            metric = "value"
        return await self.naver_client.get_hot_stocks(
            metric=metric, market=market, limit=limit
        )
