from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Stock:
    symbol: str          # "005930"
    name: str            # "삼성전자"
    market: str          # "KOSPI" | "KOSDAQ"
    sector: str = ""


@dataclass
class StockPrice:
    symbol: str
    name: str
    current_price: float
    change: float
    change_pct: float
    volume: int
    updated_at: datetime
    price_type: str = "stock"  # "stock" | "index"


@dataclass
class Candle:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass
class Fundamental:
    symbol: str
    per: float | None = None
    pbr: float | None = None
    eps: float | None = None
    bps: float | None = None
    div_yield: float | None = None
    dps: float | None = None
