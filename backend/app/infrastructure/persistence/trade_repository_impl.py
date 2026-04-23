"""SQLite 기반 TradeRepository 구현."""

from __future__ import annotations

import logging
import uuid
from functools import lru_cache

import aiosqlite

from app.config import settings
from app.domain.entity.trade import TradeEntry

logger = logging.getLogger(__name__)


_COLUMNS = (
    "id, symbol, name, entry_price, target_price, stop_loss, current_price, "
    "qty, date, time, status, emotion, news_snapshot, strategy_note"
)


def _row_to_entity(row: aiosqlite.Row) -> TradeEntry:
    return TradeEntry(
        id=row["id"],
        symbol=row["symbol"],
        name=row["name"],
        entry_price=row["entry_price"],
        target_price=row["target_price"],
        stop_loss=row["stop_loss"],
        current_price=row["current_price"],
        qty=row["qty"],
        date=row["date"],
        time=row["time"],
        status=row["status"],
        emotion=row["emotion"],
        news_snapshot=row["news_snapshot"] or "",
        strategy_note=row["strategy_note"] or "",
    )


def _entity_to_params(trade: TradeEntry) -> tuple:
    return (
        trade.id,
        trade.symbol,
        trade.name,
        trade.entry_price,
        trade.target_price,
        trade.stop_loss,
        trade.current_price,
        trade.qty,
        trade.date,
        trade.time,
        trade.status,
        trade.emotion,
        trade.news_snapshot,
        trade.strategy_note,
    )


class SQLiteTradeRepository:
    """TradeRepository Protocol 구현."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    async def list(self) -> list[TradeEntry]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                f"SELECT {_COLUMNS} FROM trades ORDER BY date DESC, time DESC"
            )
            rows = await cursor.fetchall()
            return [_row_to_entity(r) for r in rows]

    async def get(self, trade_id: str) -> TradeEntry | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                f"SELECT {_COLUMNS} FROM trades WHERE id = ?", (trade_id,)
            )
            row = await cursor.fetchone()
            return _row_to_entity(row) if row else None

    async def create(self, trade: TradeEntry) -> TradeEntry:
        if not trade.id:
            trade.id = str(uuid.uuid4())
        async with aiosqlite.connect(self.db_path) as db:
            placeholders = ", ".join("?" * 14)
            await db.execute(
                f"INSERT INTO trades ({_COLUMNS}) VALUES ({placeholders})",
                _entity_to_params(trade),
            )
            await db.commit()
        return trade

    async def update(
        self, trade_id: str, trade: TradeEntry
    ) -> TradeEntry | None:
        trade.id = trade_id
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE trades SET
                    symbol=?, name=?, entry_price=?, target_price=?,
                    stop_loss=?, current_price=?, qty=?, date=?, time=?,
                    status=?, emotion=?, news_snapshot=?, strategy_note=?
                WHERE id=?
                """,
                (
                    trade.symbol,
                    trade.name,
                    trade.entry_price,
                    trade.target_price,
                    trade.stop_loss,
                    trade.current_price,
                    trade.qty,
                    trade.date,
                    trade.time,
                    trade.status,
                    trade.emotion,
                    trade.news_snapshot,
                    trade.strategy_note,
                    trade_id,
                ),
            )
            await db.commit()
        return await self.get(trade_id)

    async def delete(self, trade_id: str) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM trades WHERE id = ?", (trade_id,)
            )
            await db.commit()
            return cursor.rowcount > 0


@lru_cache(maxsize=1)
def get_trade_repository() -> SQLiteTradeRepository:
    return SQLiteTradeRepository(settings.db_path)
