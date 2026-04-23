"""네이버 금융 차트 API 래퍼 (하이브리드 소스).

두 개의 네이버 엔드포인트를 timeframe 별로 조합하여 사용한다:

### 1) ``api.stock.naver.com/chart/domestic/item/{symbol}/{path}``
JSON 형식, 정확한 OHLC 제공. ``startDateTime`` / ``endDateTime`` 파라미터로
범위 지정. ``minute``, ``minute5``, ``day`` 에서 잘 동작.
주/월봉(``week``, ``month``) 은 기본 1건만 반환하고 날짜 파라미터가
먹히지 않아 사용 불가.

### 2) ``fchart.stock.naver.com/sise.nhn?timeframe=...``
XML 형식, ``count`` 파라미터로 개수 지정. ``week``, ``month`` 에서
정확한 OHLC 를 반환한다. ``minute`` 은 close 값만 제공하므로
사용하지 않는다.

### 라우팅 전략
- ``1min``  → api.stock.naver.com / ``minute``
- ``5min``  → api.stock.naver.com / ``minute5``
- ``day``   → api.stock.naver.com / ``day``
- ``week``  → fchart.stock.naver.com ``timeframe=week``
- ``month`` → fchart.stock.naver.com ``timeframe=month``
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import Any

import requests

from app.domain.entity.stock import Candle

logger = logging.getLogger(__name__)


JSON_BASE = "https://api.stock.naver.com/chart/domestic/item"
XML_URL = "https://fchart.stock.naver.com/sise.nhn"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Referer": "https://m.stock.naver.com/",
}


def _lookback_days(period: str, count: int) -> int:
    """startDateTime 을 얼마나 과거로 설정할지 (달력일 기준)."""

    if period in ("1min", "minute"):
        return max(2, count // 200)
    if period in ("5min", "minute5"):
        return max(3, count // 40)
    if period in ("day", "daily"):
        return int(count * 1.5) + 10
    return int(count * 1.5) + 10


def _parse_minute_item(item: dict[str, Any]) -> Candle | None:
    ts_str = item.get("localDateTime")
    if not ts_str or len(ts_str) != 14:
        return None
    try:
        ts = datetime.strptime(ts_str, "%Y%m%d%H%M%S")
        close = float(item["currentPrice"])
        open_ = float(item.get("openPrice") or close)
        high = float(item.get("highPrice") or close)
        low = float(item.get("lowPrice") or close)
        vol = int(item.get("accumulatedTradingVolume") or 0)
    except (KeyError, ValueError, TypeError):
        return None
    return Candle(
        time=ts, open=open_, high=high, low=low, close=close, volume=vol
    )


def _parse_day_item(item: dict[str, Any]) -> Candle | None:
    ts_str = item.get("localDate")
    if not ts_str or len(ts_str) != 8:
        return None
    try:
        ts = datetime.strptime(ts_str, "%Y%m%d")
        close = float(item["closePrice"])
        open_ = float(item.get("openPrice") or close)
        high = float(item.get("highPrice") or close)
        low = float(item.get("lowPrice") or close)
        vol = int(item.get("accumulatedTradingVolume") or 0)
    except (KeyError, ValueError, TypeError):
        return None
    return Candle(
        time=ts, open=open_, high=high, low=low, close=close, volume=vol
    )


_XML_ITEM_RE = re.compile(r'<item\s+data="([^"]+)"')


def _parse_xml_row(row: str) -> Candle | None:
    """`20260403|171000|193600|167000|186200|152128669` → Candle."""

    parts = row.split("|")
    if len(parts) < 6:
        return None
    if "null" in parts[:5]:  # OHLC 에 null 있으면 스킵
        return None
    try:
        ts_str = parts[0]
        if len(ts_str) == 8:
            ts = datetime.strptime(ts_str, "%Y%m%d")
        elif len(ts_str) == 12:
            ts = datetime.strptime(ts_str, "%Y%m%d%H%M")
        else:
            return None
        open_ = float(parts[1])
        high = float(parts[2])
        low = float(parts[3])
        close = float(parts[4])
        vol = int(parts[5]) if parts[5] != "null" else 0
    except ValueError:
        return None
    return Candle(
        time=ts, open=open_, high=high, low=low, close=close, volume=vol
    )


class NaverChartClient:
    """네이버 금융 차트 하이브리드 클라이언트."""

    async def get_candles(
        self, symbol: str, period: str = "day", count: int = 120
    ) -> list[Candle]:
        p = period.lower()
        if p in ("1min", "minute"):
            return await asyncio.to_thread(
                self._fetch_json, symbol, "minute", p, count
            )
        if p in ("5min", "minute5"):
            return await asyncio.to_thread(
                self._fetch_json, symbol, "minute5", p, count
            )
        if p in ("day", "daily"):
            return await asyncio.to_thread(
                self._fetch_json, symbol, "day", p, count
            )
        if p in ("week", "weekly"):
            return await asyncio.to_thread(
                self._fetch_xml, symbol, "week", count
            )
        if p in ("month", "monthly"):
            return await asyncio.to_thread(
                self._fetch_xml, symbol, "month", count
            )
        logger.warning("unknown period %s, falling back to day", period)
        return await asyncio.to_thread(self._fetch_json, symbol, "day", "day", count)

    # ── api.stock.naver.com (JSON) ─────────────────────────────────────

    def _fetch_json(
        self, symbol: str, path: str, period: str, count: int
    ) -> list[Candle]:
        end = datetime.now()
        start = end - timedelta(days=_lookback_days(period, count))
        params = {
            "startDateTime": start.strftime("%Y%m%d000000"),
            "endDateTime": end.strftime("%Y%m%d235959"),
        }
        url = f"{JSON_BASE}/{symbol}/{path}"

        try:
            from app.infrastructure.naver.rate_limiter import throttle
            from app.infrastructure.naver.http_session import get_session
            throttle()
            resp = get_session().get(url, params=params, headers=HEADERS, timeout=10)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "naver json fetch failed (%s/%s): %s", symbol, path, exc
            )
            return []
        if resp.status_code != 200:
            logger.warning(
                "naver json non-200 (%s/%s): %d", symbol, path, resp.status_code
            )
            return []
        try:
            data = resp.json()
        except ValueError as exc:
            logger.warning("naver json decode failed: %s", exc)
            return []
        if not isinstance(data, list):
            return []

        parser = _parse_minute_item if path.startswith("minute") else _parse_day_item
        candles: list[Candle] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            c = parser(item)
            if c is not None:
                candles.append(c)

        candles.sort(key=lambda c: c.time)
        if count > 0 and len(candles) > count:
            return candles[-count:]
        return candles

    # ── fchart.stock.naver.com (XML) — week/month ──────────────────────

    def _fetch_xml(
        self, symbol: str, timeframe: str, count: int
    ) -> list[Candle]:
        params = {
            "symbol": symbol,
            "timeframe": timeframe,
            "count": count,
            "requestType": 0,
        }
        try:
            from app.infrastructure.naver.rate_limiter import throttle
            from app.infrastructure.naver.http_session import get_session
            throttle()
            resp = get_session().get(XML_URL, params=params, headers=HEADERS, timeout=10)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "naver xml fetch failed (%s/%s): %s", symbol, timeframe, exc
            )
            return []
        if resp.status_code != 200:
            return []

        candles: list[Candle] = []
        for match in _XML_ITEM_RE.finditer(resp.text):
            c = _parse_xml_row(match.group(1))
            if c is not None:
                candles.append(c)

        candles.sort(key=lambda c: c.time)
        if count > 0 and len(candles) > count:
            return candles[-count:]
        return candles


_singleton: NaverChartClient | None = None


def get_naver_chart_client() -> NaverChartClient:
    global _singleton
    if _singleton is None:
        _singleton = NaverChartClient()
    return _singleton
