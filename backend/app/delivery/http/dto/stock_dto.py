from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.entity.stock import Candle, Fundamental, Stock, StockPrice


class StockDTO(BaseModel):
    symbol: str
    name: str
    market: str
    sector: str = ""

    @classmethod
    def from_entity(cls, entity: Stock) -> "StockDTO":
        return cls(
            symbol=entity.symbol,
            name=entity.name,
            market=entity.market,
            sector=entity.sector,
        )


class StockPriceDTO(BaseModel):
    symbol: str
    name: str
    current_price: float
    change: float
    change_pct: float
    volume: int
    updated_at: datetime
    price_type: str = Field(default="stock")

    @classmethod
    def from_entity(cls, entity: StockPrice) -> "StockPriceDTO":
        return cls(
            symbol=entity.symbol,
            name=entity.name,
            current_price=entity.current_price,
            change=entity.change,
            change_pct=entity.change_pct,
            volume=entity.volume,
            updated_at=entity.updated_at,
            price_type=entity.price_type,
        )


class CandleDTO(BaseModel):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    @classmethod
    def from_entity(cls, entity: Candle) -> "CandleDTO":
        return cls(
            time=entity.time,
            open=entity.open,
            high=entity.high,
            low=entity.low,
            close=entity.close,
            volume=entity.volume,
        )


class FundamentalDTO(BaseModel):
    symbol: str
    per: float | None = None
    pbr: float | None = None
    eps: float | None = None
    bps: float | None = None
    div_yield: float | None = None
    dps: float | None = None

    @classmethod
    def from_entity(cls, entity: Fundamental) -> "FundamentalDTO":
        return cls(
            symbol=entity.symbol,
            per=entity.per,
            pbr=entity.pbr,
            eps=entity.eps,
            bps=entity.bps,
            div_yield=entity.div_yield,
            dps=entity.dps,
        )
