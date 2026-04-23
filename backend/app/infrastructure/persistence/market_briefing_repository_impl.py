"""SQLite 기반 MarketBriefing 캐시 — 일자별 1개 (PRIMARY KEY = date)."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from functools import lru_cache

import aiosqlite

from app.config import settings
from app.domain.entity.market_briefing import MarketBriefing

logger = logging.getLogger(__name__)


def _to_payload(b: MarketBriefing) -> str:
    return json.dumps(
        {
            "headline": b.headline,
            "weather": b.weather,
            "briefing": b.briefing,
            "sectors_strong": b.sectors_strong,
            "sectors_weak": b.sectors_weak,
        },
        ensure_ascii=False,
    )


def _from_payload(
    date: str, raw: str, computed_at: datetime
) -> MarketBriefing | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return MarketBriefing(
        date=date,
        headline=str(data.get("headline", "")),
        weather=str(data.get("weather", "흐림")),
        briefing=str(data.get("briefing", "")),
        sectors_strong=[str(x) for x in data.get("sectors_strong", [])],
        sectors_weak=[str(x) for x in data.get("sectors_weak", [])],
        computed_at=computed_at,
    )


class SQLiteMarketBriefingRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    async def get_by_date(self, date: str) -> MarketBriefing | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT date, payload, computed_at "
                "FROM market_briefings WHERE date = ?",
                (date,),
            )
            row = await cursor.fetchone()
            if row is None:
                return None
            try:
                computed_at = datetime.fromisoformat(row["computed_at"])
            except (ValueError, TypeError):
                computed_at = datetime.now()
            return _from_payload(row["date"], row["payload"], computed_at)

    async def save(self, briefing: MarketBriefing) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO market_briefings
                    (date, payload, computed_at)
                VALUES (?, ?, ?)
                """,
                (
                    briefing.date,
                    _to_payload(briefing),
                    (briefing.computed_at or datetime.now()).isoformat(),
                ),
            )
            await db.commit()


@lru_cache(maxsize=1)
def get_market_briefing_repository() -> SQLiteMarketBriefingRepository:
    return SQLiteMarketBriefingRepository(settings.db_path)
