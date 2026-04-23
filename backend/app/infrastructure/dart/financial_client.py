"""DART Open API 재무비율 수집 (docs/02 버핏/오닐 지표).

3개 ``idx_cl_code`` 호출로 ROE, 부채비율, 순이익률, 매출/영업/순이익 증가율 획득:
  - M210000 수익성 (ROE, 순이익률)
  - M220000 안정성 (부채비율)
  - M230000 성장성 (매출/영업이익/순이익 증가율 YoY)

결과는 SQLite 에 7일 TTL 캐시 — 재무비율은 분기 확정값이라 짧게 바꿀 필요 없음.
``DartDisclosureRepository._get_corp`` 로 symbol → corp_code 매핑 재사용.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from functools import lru_cache

import aiosqlite
import requests

from app.config import settings
from app.infrastructure.dart.disclosure_repository_impl import (
    get_dart_disclosure_repository,
)

logger = logging.getLogger(__name__)


API_URL = "https://opendart.fss.or.kr/api/fnlttSinglIndx.json"

# 보고서 코드: 사업(11011) 반기(11012) 1Q(11013) 3Q(11014)
_REPRT_CODES = ["11011", "11014", "11012", "11013"]

CACHE_TTL = timedelta(days=7)


def _reprt_code_for(quarter: int) -> str:
    if quarter == 1:
        return "11013"
    if quarter == 2:
        return "11012"
    if quarter == 3:
        return "11014"
    return "11011"


def _parse_float(v) -> float | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "none":
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


class DartFinancialClient:
    """재무비율 조회 — DART Open API fnlttSinglIndx."""

    def __init__(self) -> None:
        self._disclosure_repo = get_dart_disclosure_repository()

    async def get_financials(self, symbol: str) -> dict:
        """ROE/부채비율/증가율 등 dict 반환. 캐시 hit 시 DB 에서 즉시.

        반환 키: ``roe, debt_ratio, net_profit_margin, revenue_growth,
        net_income_growth, op_income_growth`` (각 float | None).
        """

        # 1. 캐시 조회 (TTL 7일)
        cached = await self._load_from_cache(symbol)
        if cached is not None:
            return cached

        # 2. corp_code 매핑
        corp = await asyncio.to_thread(
            self._disclosure_repo._get_corp, symbol
        )
        if corp is None:
            return _empty()
        corp_code = getattr(corp, "corp_code", None)
        if not corp_code:
            return _empty()

        # 3. DART 호출 (가장 최근 확정 분기부터 재시도)
        data = await asyncio.to_thread(self._fetch_sync, corp_code)

        # 4. 캐시 저장
        try:
            await self._save_to_cache(symbol, data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("dart financial cache save failed: %s", exc)

        return data

    def _fetch_sync(self, corp_code: str) -> dict:
        """최신 연도/분기부터 역순으로 시도해 데이터가 있는 첫 보고서 사용."""

        now = datetime.now()
        years = [now.year, now.year - 1]
        for year in years:
            for reprt in _REPRT_CODES:
                try:
                    merged = self._fetch_year(corp_code, year, reprt)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "dart fnlttSinglIndx error %s/%s: %s",
                        year,
                        reprt,
                        exc,
                    )
                    continue
                # 최소한 ROE 또는 부채비율이 채워져야 유효
                if merged.get("roe") is not None or merged.get("debt_ratio") is not None:
                    merged["_year"] = year
                    merged["_reprt_code"] = reprt
                    return merged
        return _empty()

    def _fetch_year(self, corp_code: str, year: int, reprt_code: str) -> dict:
        result: dict = {
            "roe": None,
            "debt_ratio": None,
            "net_profit_margin": None,
            "revenue_growth": None,
            "net_income_growth": None,
            "op_income_growth": None,
        }
        idx_map = {
            "M210000": ["ROE", "순이익률"],
            "M220000": ["부채비율"],
            "M230000": [
                "매출액증가율(YoY)",
                "영업이익증가율(YoY)",
                "순이익증가율(YoY)",
            ],
        }
        for idx_cl, _ in idx_map.items():
            resp = requests.get(
                API_URL,
                params={
                    "crtfc_key": settings.dart_api_key,
                    "corp_code": corp_code,
                    "bsns_year": str(year),
                    "reprt_code": reprt_code,
                    "idx_cl_code": idx_cl,
                },
                timeout=10,
            )
            payload = resp.json()
            if payload.get("status") != "000":
                continue
            for item in payload.get("list", []):
                name = item.get("idx_nm", "")
                val = _parse_float(item.get("idx_val"))
                if name == "ROE":
                    result["roe"] = val
                elif name == "순이익률":
                    result["net_profit_margin"] = val
                elif name == "부채비율":
                    result["debt_ratio"] = val
                elif name == "매출액증가율(YoY)":
                    result["revenue_growth"] = val
                elif name == "영업이익증가율(YoY)":
                    result["op_income_growth"] = val
                elif name == "순이익증가율(YoY)":
                    result["net_income_growth"] = val
        return result

    # ── SQLite 캐시 ─────────────────────────────────────────────────────

    async def _load_from_cache(self, symbol: str) -> dict | None:
        try:
            async with aiosqlite.connect(settings.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(
                    "SELECT * FROM dart_financials WHERE symbol = ?",
                    (symbol,),
                )
                row = await cursor.fetchone()
                if row is None:
                    return None
                fetched_at = datetime.fromisoformat(row["fetched_at"])
                if datetime.now() - fetched_at > CACHE_TTL:
                    return None
                return {
                    "roe": row["roe"],
                    "debt_ratio": row["debt_ratio"],
                    "net_profit_margin": row["net_profit_margin"],
                    "revenue_growth": row["revenue_growth"],
                    "net_income_growth": row["net_income_growth"],
                    "op_income_growth": row["op_income_growth"],
                }
        except Exception as exc:  # noqa: BLE001
            logger.warning("dart financial cache load failed: %s", exc)
            return None

    async def _save_to_cache(self, symbol: str, data: dict) -> None:
        async with aiosqlite.connect(settings.db_path) as db:
            await db.execute(
                """
                INSERT OR REPLACE INTO dart_financials
                    (symbol, year, reprt_code, roe, debt_ratio,
                     net_profit_margin, revenue_growth, net_income_growth,
                     op_income_growth, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    symbol,
                    data.get("_year"),
                    data.get("_reprt_code"),
                    data.get("roe"),
                    data.get("debt_ratio"),
                    data.get("net_profit_margin"),
                    data.get("revenue_growth"),
                    data.get("net_income_growth"),
                    data.get("op_income_growth"),
                    datetime.now().isoformat(),
                ),
            )
            await db.commit()


def _empty() -> dict:
    return {
        "roe": None,
        "debt_ratio": None,
        "net_profit_margin": None,
        "revenue_growth": None,
        "net_income_growth": None,
        "op_income_growth": None,
    }


@lru_cache(maxsize=1)
def get_dart_financial_client() -> DartFinancialClient:
    return DartFinancialClient()
