"""SQLite 데이터베이스 초기화."""

from __future__ import annotations

import logging
from pathlib import Path

import aiosqlite

from app.config import settings

logger = logging.getLogger(__name__)


SCHEMA_TRADES = """
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    entry_price INTEGER NOT NULL,
    target_price INTEGER NOT NULL,
    stop_loss INTEGER,
    current_price INTEGER,
    qty INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL,
    emotion TEXT NOT NULL,
    news_snapshot TEXT NOT NULL DEFAULT '',
    strategy_note TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
)
"""


SCHEMA_AI_ANALYSES = """
CREATE TABLE IF NOT EXISTS ai_analyses (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    decision TEXT NOT NULL,
    target_price REAL,
    confidence INTEGER NOT NULL,
    summary TEXT NOT NULL,
    positives TEXT NOT NULL DEFAULT '[]',
    risks TEXT NOT NULL DEFAULT '[]',
    reasoning TEXT NOT NULL,
    rsi REAL,
    macd_state TEXT,
    news_count INTEGER DEFAULT 0,
    price_at_analysis REAL,
    created_at TEXT NOT NULL
)
"""

INDEX_AI_ANALYSES = """
CREATE INDEX IF NOT EXISTS idx_ai_analyses_symbol
ON ai_analyses(symbol, created_at DESC)
"""


SCHEMA_PRICE_LEVELS = """
CREATE TABLE IF NOT EXISTS price_levels (
    symbol TEXT PRIMARY KEY,
    current_price REAL NOT NULL,
    levels TEXT NOT NULL,          -- JSON array of PriceLevel dicts
    computed_at TEXT NOT NULL
)
"""

SCHEMA_MASTER_SCORES = """
CREATE TABLE IF NOT EXISTS master_scores (
    symbol TEXT PRIMARY KEY,
    stock_name TEXT NOT NULL,
    payload TEXT NOT NULL,         -- JSON {buffett, oneill, livermore, star_score, fundamental}
    computed_at TEXT NOT NULL
)
"""

SCHEMA_MARKET_BRIEFINGS = """
CREATE TABLE IF NOT EXISTS market_briefings (
    date TEXT PRIMARY KEY,         -- YYYY-MM-DD (자정 기준 1일 1회)
    payload TEXT NOT NULL,         -- JSON {headline, weather, briefing, sectors_*}
    computed_at TEXT NOT NULL
)
"""


SCHEMA_DART_FINANCIALS = """
CREATE TABLE IF NOT EXISTS dart_financials (
    symbol TEXT PRIMARY KEY,
    year INTEGER,
    reprt_code TEXT,                 -- 11011 사업 / 11012 반기 / 11013 1Q / 11014 3Q
    roe REAL,
    debt_ratio REAL,
    net_profit_margin REAL,
    revenue_growth REAL,
    net_income_growth REAL,
    op_income_growth REAL,
    fetched_at TEXT NOT NULL
)
"""


SCHEMA_CANDLES = """
CREATE TABLE IF NOT EXISTS candles (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,          -- day | week | 1min | 5min
    ts TEXT NOT NULL,              -- ISO datetime (정렬 키)
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL,
    fetched_at TEXT NOT NULL,      -- 분봉 TTL 판정용
    PRIMARY KEY (symbol, period, ts)
)
"""

INDEX_CANDLES = """
CREATE INDEX IF NOT EXISTS idx_candles_lookup
ON candles(symbol, period, ts DESC)
"""


async def init_db() -> None:
    db_path = Path(settings.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(db_path) as db:
        # B4: WAL 모드 — 동시 읽기/쓰기 블록 해소
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.execute("PRAGMA temp_store=MEMORY")
        await db.execute("PRAGMA cache_size=-64000")  # 64MB 캐시

        await db.execute(SCHEMA_TRADES)
        await db.execute(SCHEMA_AI_ANALYSES)
        await db.execute(INDEX_AI_ANALYSES)
        await db.execute(SCHEMA_PRICE_LEVELS)
        await db.execute(SCHEMA_MASTER_SCORES)
        await db.execute(SCHEMA_MARKET_BRIEFINGS)
        await db.execute(SCHEMA_CANDLES)
        await db.execute(INDEX_CANDLES)
        await db.execute(SCHEMA_DART_FINANCIALS)
        # B6: 자주 쓰는 조회 경로 인덱스
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_candles_fetched "
            "ON candles(symbol, period, fetched_at DESC)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_trades_symbol_status "
            "ON trades(symbol, status)"
        )
        await db.commit()
    logger.info("SQLite initialized at %s (WAL mode)", db_path)
