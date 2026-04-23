from __future__ import annotations

from pydantic import BaseModel

from app.infrastructure.naver.market_rank_client import HotStockRow


class HotStockDTO(BaseModel):
    rank: int
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: int
    trade_value: int

    @classmethod
    def from_entity(cls, entity: HotStockRow) -> "HotStockDTO":
        return cls(
            rank=entity.rank,
            symbol=entity.symbol,
            name=entity.name,
            price=entity.price,
            change=entity.change,
            change_pct=entity.change_pct,
            volume=entity.volume,
            trade_value=entity.trade_value,
        )
