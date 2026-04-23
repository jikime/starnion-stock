from __future__ import annotations

from pydantic import BaseModel, Field

from app.domain.entity.trade import TradeEntry


class TradeDTO(BaseModel):
    id: str
    symbol: str
    name: str
    entry_price: int
    target_price: int
    stop_loss: int | None = None
    current_price: int | None = None
    qty: int
    date: str
    time: str
    status: str
    emotion: str
    news_snapshot: str = ""
    strategy_note: str = ""

    @classmethod
    def from_entity(cls, entity: TradeEntry) -> "TradeDTO":
        return cls(
            id=entity.id,
            symbol=entity.symbol,
            name=entity.name,
            entry_price=entity.entry_price,
            target_price=entity.target_price,
            stop_loss=entity.stop_loss,
            current_price=entity.current_price,
            qty=entity.qty,
            date=entity.date,
            time=entity.time,
            status=entity.status,
            emotion=entity.emotion,
            news_snapshot=entity.news_snapshot,
            strategy_note=entity.strategy_note,
        )


class TradeCreateDTO(BaseModel):
    symbol: str
    name: str
    entry_price: int
    target_price: int
    stop_loss: int | None = None
    current_price: int | None = None
    qty: int
    date: str
    time: str
    status: str = "open"
    emotion: str = "중립"
    news_snapshot: str = ""
    strategy_note: str = ""

    def to_entity(self) -> TradeEntry:
        return TradeEntry(
            id="",
            symbol=self.symbol,
            name=self.name,
            entry_price=self.entry_price,
            target_price=self.target_price,
            stop_loss=self.stop_loss,
            current_price=self.current_price,
            qty=self.qty,
            date=self.date,
            time=self.time,
            status=self.status,
            emotion=self.emotion,
            news_snapshot=self.news_snapshot,
            strategy_note=self.strategy_note,
        )
