"""SQLite 기반 PriceLevelRepository 구현.

종목당 최신 스냅샷 1개만 유지한다 (``INSERT OR REPLACE``).
TTL 체크는 호출자(``LevelUseCase``) 가 ``computed_at`` 으로 판단.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from functools import lru_cache

import aiosqlite

from app.config import settings
from app.domain.entity.price_level import PriceLevel, PriceLevelsSnapshot

logger = logging.getLogger(__name__)


def _levels_to_json(levels: list[PriceLevel]) -> str:
    return json.dumps(
        [
            {
                "price": lv.price,
                "kind": lv.kind,
                "touch_count": lv.touch_count,
                "strength": lv.strength,
                "explanation": lv.explanation,
            }
            for lv in levels
        ],
        ensure_ascii=False,
    )


def _json_to_levels(raw: str) -> list[PriceLevel]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    result: list[PriceLevel] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            result.append(
                PriceLevel(
                    price=float(item["price"]),
                    kind=str(item["kind"]),
                    touch_count=int(item.get("touch_count", 0)),
                    strength=int(item.get("strength", 0)),
                    explanation=str(item.get("explanation", "")),
                )
            )
        except (KeyError, ValueError, TypeError):
            continue
    return result


class SQLitePriceLevelRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    async def get_latest(self, symbol: str) -> PriceLevelsSnapshot | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT symbol, current_price, levels, computed_at "
                "FROM price_levels WHERE symbol = ?",
                (symbol,),
            )
            row = await cursor.fetchone()
            if row is None:
                return None
            try:
                computed_at = datetime.fromisoformat(row["computed_at"])
            except (ValueError, TypeError):
                computed_at = datetime.now()
            return PriceLevelsSnapshot(
                symbol=row["symbol"],
                current_price=float(row["current_price"]),
                levels=_json_to_levels(row["levels"]),
                computed_at=computed_at,
            )

    async def save(self, snapshot: PriceLevelsSnapshot) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO price_levels
                    (symbol, current_price, levels, computed_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    snapshot.symbol,
                    snapshot.current_price,
                    _levels_to_json(snapshot.levels),
                    snapshot.computed_at.isoformat(),
                ),
            )
            await db.commit()


@lru_cache(maxsize=1)
def get_price_level_repository() -> SQLitePriceLevelRepository:
    return SQLitePriceLevelRepository(settings.db_path)
