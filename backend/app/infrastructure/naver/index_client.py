"""네이버 금융 지수 페이지 크롤러.

pykrx 의 ``get_index_ohlcv_by_date`` 가 KRX 웹사이트 변경으로 실패하는
경우가 있어, 네이버 금융 HTML 을 파싱하여 대체 데이터를 제공한다.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from app.domain.entity.stock import StockPrice

logger = logging.getLogger(__name__)


INDEX_URL = "https://finance.naver.com/sise/sise_index.naver"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}


INDEX_CODES: dict[str, str] = {
    "KOSPI": "코스피",
    "KOSDAQ": "코스닥",
    "KPI200": "코스피200",
}


def _fetch_one(code: str, name: str) -> StockPrice | None:
    try:
        from app.infrastructure.naver.http_session import get_session
        resp = get_session().get(
            INDEX_URL, params={"code": code}, headers=HEADERS, timeout=10
        )
        resp.encoding = "euc-kr"
        soup = BeautifulSoup(resp.text, "lxml")
    except Exception as exc:  # noqa: BLE001
        logger.warning("naver index fetch failed (%s): %s", code, exc)
        return None

    now_el = soup.select_one("#now_value")
    change_el = soup.select_one("#change_value_and_rate")
    if now_el is None:
        return None

    current = _parse_number(now_el.get_text(strip=True))
    change_text = change_el.get_text(strip=True) if change_el else ""
    change, change_pct = _parse_change(change_text)

    return StockPrice(
        symbol=code,
        name=name,
        current_price=current,
        change=change,
        change_pct=change_pct,
        volume=0,
        updated_at=datetime.now(),
        price_type="index",
    )


_NUM_RE = re.compile(r"[-+]?[\d,]+\.?\d*")
_PCT_RE = re.compile(r"([-+]?\d+\.\d+)%")


def _parse_number(text: str) -> float:
    if not text:
        return 0.0
    cleaned = text.replace(",", "").strip()
    match = _NUM_RE.search(cleaned)
    if not match:
        return 0.0
    try:
        return float(match.group())
    except ValueError:
        return 0.0


def _parse_change(text: str) -> tuple[float, float]:
    """네이버 형식 '149.35+2.50%상승' → (149.35, 2.50) 또는 음수."""

    if not text:
        return (0.0, 0.0)

    is_down = "하락" in text or "-" in text

    # 퍼센트 먼저 추출
    pct = 0.0
    pct_match = _PCT_RE.search(text)
    if pct_match:
        pct = float(pct_match.group(1))

    # 퍼센트 앞부분이 절대 변화량
    if pct_match:
        prefix = text[: pct_match.start()]
    else:
        prefix = text
    num_match = _NUM_RE.search(prefix.replace(",", ""))
    change = float(num_match.group()) if num_match else 0.0

    if is_down:
        change = -abs(change)
        pct = -abs(pct)
    return (change, pct)


class NaverIndexClient:
    """네이버 금융 페이지 기반 시장 지수 조회."""

    async def get_market_indices(self) -> list[StockPrice]:
        def _fetch_all() -> list[StockPrice]:
            results: list[StockPrice] = []
            for code, name in INDEX_CODES.items():
                price = _fetch_one(code, name)
                if price is not None:
                    results.append(price)
            return results

        return await asyncio.to_thread(_fetch_all)
