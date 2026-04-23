"""네이버 종목 메인 페이지에서 PER/EPS/PBR/배당률 스크래핑.

``finance.naver.com/item/main.naver?code={symbol}`` 의 ``per_table`` 안
``em#_per``, ``em#_eps``, ``em#_pbr``, ``em#_dvr`` 4개 ID 로 추출.

pykrx ``get_market_fundamental_by_date`` 가 KRX 페이지 변경으로 빈
DataFrame 을 반환하는 이슈를 우회한다.
"""

from __future__ import annotations

import asyncio
import logging
import re

import requests
from bs4 import BeautifulSoup

from app.domain.entity.master_score import FundamentalSnapshot

logger = logging.getLogger(__name__)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

MAIN_URL = "https://finance.naver.com/item/main.naver"


_NUMBER_RE = re.compile(r"-?[\d,]+\.?\d*")


class NaverFundamentalClient:
    async def get_fundamental(self, symbol: str) -> FundamentalSnapshot:
        return await asyncio.to_thread(self._fetch_sync, symbol)

    def _fetch_sync(self, symbol: str) -> FundamentalSnapshot:
        try:
            from app.infrastructure.naver.rate_limiter import throttle
            from app.infrastructure.naver.http_session import get_session
            throttle()
            resp = get_session().get(
                MAIN_URL,
                params={"code": symbol},
                headers=HEADERS,
                timeout=10,
            )
            resp.encoding = "utf-8"
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "naver fundamental fetch failed for %s: %s", symbol, exc
            )
            return FundamentalSnapshot()

        return FundamentalSnapshot(
            per=_extract_em(soup, "_per"),
            eps=_extract_em(soup, "_eps"),
            pbr=_extract_em(soup, "_pbr"),
            dividend_yield=_extract_em(soup, "_dvr"),
        )


def _extract_em(soup: BeautifulSoup, em_id: str) -> float | None:
    el = soup.find("em", id=em_id)
    if not el:
        return None
    text = el.get_text(strip=True)
    m = _NUMBER_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


_singleton: NaverFundamentalClient | None = None


def get_fundamental_client() -> NaverFundamentalClient:
    global _singleton
    if _singleton is None:
        _singleton = NaverFundamentalClient()
    return _singleton
