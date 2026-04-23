"""SQLite 기반 AIAnalysisRepository 구현.

``trades.db`` 에 동거하며, ``ai_analyses`` 테이블에 Claude 분석 결과를
히스토리로 보존한다.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from functools import lru_cache

import aiosqlite

from app.config import settings
from app.domain.entity.ai_analysis import AIAnalysis

logger = logging.getLogger(__name__)


_COLUMNS = (
    "id, symbol, stock_name, decision, target_price, confidence, "
    "summary, positives, risks, reasoning, rsi, macd_state, "
    "news_count, price_at_analysis, created_at"
)


def _row_to_entity(row: aiosqlite.Row) -> AIAnalysis:
    def _parse_list(raw: str | None) -> list[str]:
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            return [str(x) for x in parsed] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []

    created_raw = row["created_at"]
    try:
        created_at = (
            datetime.fromisoformat(created_raw) if created_raw else None
        )
    except (ValueError, TypeError):
        created_at = None

    return AIAnalysis(
        id=row["id"],
        symbol=row["symbol"],
        stock_name=row["stock_name"],
        decision=row["decision"],
        confidence=int(row["confidence"]),
        summary=row["summary"],
        reasoning=row["reasoning"],
        positives=_parse_list(row["positives"]),
        risks=_parse_list(row["risks"]),
        target_price=row["target_price"],
        rsi=row["rsi"],
        macd_state=row["macd_state"],
        news_count=int(row["news_count"] or 0),
        price_at_analysis=row["price_at_analysis"],
        created_at=created_at,
    )


class SQLiteAIAnalysisRepository:
    """AIAnalysisRepository Protocol 구현."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    async def create(self, analysis: AIAnalysis) -> AIAnalysis:
        if not analysis.id:
            analysis.id = str(uuid.uuid4())
        if analysis.created_at is None:
            analysis.created_at = datetime.now()

        async with aiosqlite.connect(self.db_path) as db:
            placeholders = ", ".join("?" * 15)
            await db.execute(
                f"INSERT INTO ai_analyses ({_COLUMNS}) VALUES ({placeholders})",
                (
                    analysis.id,
                    analysis.symbol,
                    analysis.stock_name,
                    analysis.decision,
                    analysis.target_price,
                    analysis.confidence,
                    analysis.summary,
                    json.dumps(analysis.positives, ensure_ascii=False),
                    json.dumps(analysis.risks, ensure_ascii=False),
                    analysis.reasoning,
                    analysis.rsi,
                    analysis.macd_state,
                    analysis.news_count,
                    analysis.price_at_analysis,
                    analysis.created_at.isoformat(),
                ),
            )
            await db.commit()
        return analysis

    async def list_by_symbol(
        self, symbol: str, limit: int = 20
    ) -> list[AIAnalysis]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                f"""
                SELECT {_COLUMNS} FROM ai_analyses
                WHERE symbol = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (symbol, limit),
            )
            rows = await cursor.fetchall()
            return [_row_to_entity(r) for r in rows]

    async def get(self, analysis_id: str) -> AIAnalysis | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                f"SELECT {_COLUMNS} FROM ai_analyses WHERE id = ?",
                (analysis_id,),
            )
            row = await cursor.fetchone()
            return _row_to_entity(row) if row else None

    async def delete(self, analysis_id: str) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM ai_analyses WHERE id = ?", (analysis_id,)
            )
            await db.commit()
            return cursor.rowcount > 0


@lru_cache(maxsize=1)
def get_ai_analysis_repository() -> SQLiteAIAnalysisRepository:
    return SQLiteAIAnalysisRepository(settings.db_path)
