"""Stock 유즈케이스. pykrx 등 인프라를 통해 종목/시세/OHLCV 제공."""

from __future__ import annotations

from datetime import datetime

from app.domain.entity.stock import Candle, Fundamental, Stock, StockPrice
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.naver.market_rank_client import NaverMarketRankClient


class StockUseCase:
    def __init__(
        self,
        stock_repo: StockRepository,
        market_rank_client: NaverMarketRankClient | None = None,
    ) -> None:
        self.stock_repo = stock_repo
        self.market_rank_client = market_rank_client

    async def list_all(self) -> list[Stock]:
        return await self.stock_repo.list_all()

    async def search(self, query: str, limit: int = 20) -> list[Stock]:
        return await self.stock_repo.search(query, limit=limit)

    async def get_price(self, symbol: str) -> StockPrice | None:
        return await self.stock_repo.get_price(symbol)

    async def get_candles(
        self,
        symbol: str,
        period: str = "day",
        count: int = 120,
        before: datetime | None = None,
    ) -> list[Candle]:
        return await self.stock_repo.get_candles(
            symbol, period, count, before=before
        )

    async def get_market_tickers(
        self, watchlist: list[str] | None = None
    ) -> list[StockPrice]:
        indices = await self.stock_repo.get_market_indices()
        tickers: list[StockPrice] = list(indices)
        if watchlist:
            prices = await self.stock_repo.get_market_tickers(watchlist)
            tickers.extend(prices)
        return tickers

    async def get_top_market_cap(
        self, market: str = "KOSPI", limit: int = 10
    ) -> list[Stock]:
        """시가총액 상위 종목을 심볼 리스트로 가져와 Stock 엔티티로 확장."""

        if self.market_rank_client is None:
            return []
        symbols = await self.market_rank_client.get_top_market_cap(
            market=market, limit=limit
        )
        return await self._symbols_to_stocks(symbols)

    async def get_index_constituents(
        self, index_code: str = "KPI200", limit: int = 30
    ) -> list[Stock]:
        """지수(KPI200/KOSDAQ150 등) 구성 종목 상위 N개."""

        if self.market_rank_client is None:
            return []
        symbols = await self.market_rank_client.get_index_constituents(
            index_code=index_code, limit=limit
        )
        return await self._symbols_to_stocks(symbols)

    async def _symbols_to_stocks(self, symbols: list[str]) -> list[Stock]:
        """심볼 리스트를 종목 마스터(JSON)와 조인하여 Stock 엔티티로 변환.

        마스터에 없는 심볼은 최소 정보(name=symbol)만 채워 반환.
        마스터 로드 순서는 유지한다.
        """

        all_stocks = await self.stock_repo.list_all()
        master: dict[str, Stock] = {s.symbol: s for s in all_stocks}
        result: list[Stock] = []
        for sym in symbols:
            stock = master.get(sym)
            if stock is None:
                stock = Stock(symbol=sym, name=sym, market="KOSPI", sector="")
            result.append(stock)
        return result

    async def get_fundamental(self, symbol: str) -> Fundamental | None:
        return await self.stock_repo.get_fundamental(symbol)
