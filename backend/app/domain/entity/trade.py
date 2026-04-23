from dataclasses import dataclass


@dataclass
class TradeEntry:
    id: str
    symbol: str
    name: str
    entry_price: int
    target_price: int
    stop_loss: int | None
    current_price: int | None
    qty: int
    date: str       # "YYYY-MM-DD"
    time: str       # "HH:MM"
    status: str     # "open" | "closed" | "target"
    emotion: str    # "확신" | "불안" | "중립" | "흥분"
    news_snapshot: str = ""
    strategy_note: str = ""
