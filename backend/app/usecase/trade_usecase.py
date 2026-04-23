"""매매 기록 CRUD 유즈케이스.

매매 기록(trade) 은 진입 시점의 정보를 DB 에 불변으로 저장하지만,
``current_price`` 필드는 응답 시점의 실시간 시세로 덮어써서 반환한다.
DB 에는 진입 당시의 스냅샷이 유지되고, 화면에서는 실시간 평가손익을
계산할 수 있도록 하기 위함이다.
"""

from __future__ import annotations

import asyncio
import logging

from app.domain.entity.stock import StockPrice
from app.domain.entity.trade import TradeEntry
from app.domain.repository.stock_repository import StockRepository
from app.domain.repository.trade_repository import TradeRepository

logger = logging.getLogger(__name__)


class TradeUseCase:
    def __init__(
        self,
        trade_repo: TradeRepository,
        stock_repo: StockRepository | None = None,
    ) -> None:
        self.trade_repo = trade_repo
        self.stock_repo = stock_repo

    async def list(self) -> list[TradeEntry]:
        trades = await self.trade_repo.list()
        return await self._hydrate_current_prices(trades)

    async def get(self, trade_id: str) -> TradeEntry | None:
        trade = await self.trade_repo.get(trade_id)
        if trade is None:
            return None
        hydrated = await self._hydrate_current_prices([trade])
        return hydrated[0] if hydrated else trade

    async def create(self, trade: TradeEntry) -> TradeEntry:
        return await self.trade_repo.create(trade)

    async def update(
        self, trade_id: str, trade: TradeEntry
    ) -> TradeEntry | None:
        return await self.trade_repo.update(trade_id, trade)

    async def delete(self, trade_id: str) -> bool:
        return await self.trade_repo.delete(trade_id)

    # ── helpers ─────────────────────────────────────────────────────────

    async def _hydrate_current_prices(
        self, trades: list[TradeEntry]
    ) -> list[TradeEntry]:
        """각 매매 기록의 ``current_price`` 를 실시간 시세로 대체.

        같은 종목이 여러 번 등장해도 실제 시세 조회는 종목당 1회만 수행.
        실패한 종목은 진입가(entry_price) 를 그대로 유지한다.
        """

        if not trades or self.stock_repo is None:
            return trades

        unique_symbols = list({t.symbol for t in trades})
        tasks = [self.stock_repo.get_price(sym) for sym in unique_symbols]
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to fetch trade prices: %s", exc)
            return trades

        price_map: dict[str, int] = {}
        for sym, result in zip(unique_symbols, results):
            if not isinstance(result, StockPrice):
                continue
            price: StockPrice = result
            try:
                price_map[sym] = int(round(price.current_price))
            except (TypeError, ValueError):
                continue

        for trade in trades:
            latest = price_map.get(trade.symbol)
            if latest is not None:
                trade.current_price = latest
        return trades
