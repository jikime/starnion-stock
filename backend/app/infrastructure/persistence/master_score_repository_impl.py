"""SQLite 기반 MasterScores 캐시 — 종목당 최신 1개 유지, TTL 1시간."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from functools import lru_cache

import aiosqlite

from app.config import settings
from app.domain.entity.master_score import (
    ForeignFlowPoint,
    FundamentalSnapshot,
    MasterScore,
    MasterScores,
)

logger = logging.getLogger(__name__)


def _scores_to_json(scores: MasterScores) -> str:
    def _master(m: MasterScore) -> dict:
        return {
            "name": m.name,
            "label": m.label,
            "score": m.score,
            "signal": m.signal,
            "reasons": m.reasons,
        }

    return json.dumps(
        {
            "buffett": _master(scores.buffett),
            "oneill": _master(scores.oneill),
            "livermore": _master(scores.livermore),
            "star_score": scores.star_score,
            "commentary": scores.commentary,
            "volume_ratio": scores.volume_ratio,
            "retail_net_5d": scores.retail_net_5d,
            "macro_notes": scores.macro_notes,
            "foreign_flow": [
                {"date": p.date, "net": p.net} for p in scores.foreign_flow
            ],
            "institution_flow": [
                {"date": p.date, "net": p.net}
                for p in scores.institution_flow
            ],
            "fundamental": {
                "per": scores.fundamental.per,
                "eps": scores.fundamental.eps,
                "pbr": scores.fundamental.pbr,
                "dividend_yield": scores.fundamental.dividend_yield,
                "roe": scores.fundamental.roe,
                "debt_ratio": scores.fundamental.debt_ratio,
                "net_profit_margin": scores.fundamental.net_profit_margin,
                "revenue_growth": scores.fundamental.revenue_growth,
                "net_income_growth": scores.fundamental.net_income_growth,
                "op_income_growth": scores.fundamental.op_income_growth,
            },
        },
        ensure_ascii=False,
    )


def _json_to_scores(
    symbol: str, stock_name: str, raw: str, computed_at: datetime
) -> MasterScores | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    def _master(d: dict) -> MasterScore:
        return MasterScore(
            name=str(d.get("name", "")),
            label=str(d.get("label", "")),
            score=int(d.get("score", 0)),
            signal=str(d.get("signal", "HOLD")),
            reasons=[str(x) for x in d.get("reasons", [])],
        )

    fund_d = data.get("fundamental", {}) or {}
    flow_raw = data.get("foreign_flow", []) or []
    foreign_flow = [
        ForeignFlowPoint(date=str(f.get("date", "")), net=int(f.get("net", 0)))
        for f in flow_raw
        if isinstance(f, dict)
    ]
    inst_raw = data.get("institution_flow", []) or []
    institution_flow = [
        ForeignFlowPoint(date=str(f.get("date", "")), net=int(f.get("net", 0)))
        for f in inst_raw
        if isinstance(f, dict)
    ]
    return MasterScores(
        symbol=symbol,
        stock_name=stock_name,
        buffett=_master(data.get("buffett", {})),
        oneill=_master(data.get("oneill", {})),
        livermore=_master(data.get("livermore", {})),
        star_score=int(data.get("star_score", 0)),
        fundamental=FundamentalSnapshot(
            per=fund_d.get("per"),
            eps=fund_d.get("eps"),
            pbr=fund_d.get("pbr"),
            dividend_yield=fund_d.get("dividend_yield"),
            roe=fund_d.get("roe"),
            debt_ratio=fund_d.get("debt_ratio"),
            net_profit_margin=fund_d.get("net_profit_margin"),
            revenue_growth=fund_d.get("revenue_growth"),
            net_income_growth=fund_d.get("net_income_growth"),
            op_income_growth=fund_d.get("op_income_growth"),
        ),
        computed_at=computed_at,
        commentary=str(data.get("commentary", "")),
        foreign_flow=foreign_flow,
        institution_flow=institution_flow,
        volume_ratio=data.get("volume_ratio"),
        retail_net_5d=data.get("retail_net_5d"),
        macro_notes=data.get("macro_notes") or [],
    )


class SQLiteMasterScoreRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    async def get_latest(self, symbol: str) -> MasterScores | None:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT symbol, stock_name, payload, computed_at "
                "FROM master_scores WHERE symbol = ?",
                (symbol,),
            )
            row = await cursor.fetchone()
            if row is None:
                return None
            try:
                computed_at = datetime.fromisoformat(row["computed_at"])
            except (ValueError, TypeError):
                computed_at = datetime.now()
            return _json_to_scores(
                row["symbol"],
                row["stock_name"],
                row["payload"],
                computed_at,
            )

    async def save(self, scores: MasterScores) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO master_scores
                    (symbol, stock_name, payload, computed_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    scores.symbol,
                    scores.stock_name,
                    _scores_to_json(scores),
                    scores.computed_at.isoformat(),
                ),
            )
            await db.commit()


@lru_cache(maxsize=1)
def get_master_score_repository() -> SQLiteMasterScoreRepository:
    return SQLiteMasterScoreRepository(settings.db_path)
