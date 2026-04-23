"""네이버 금융 메인 뉴스 페이지 크롤러.

종목 무관한 시장 메인 뉴스를 수집한다. 종목별 뉴스(``news_repository_impl``)
와는 분리된 별도 페이지 (``finance.naver.com/news/mainnews.naver``) 를 사용.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timedelta
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.domain.entity.market_news import MarketNewsItem

logger = logging.getLogger(__name__)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

MAIN_NEWS_URL = "https://finance.naver.com/news/mainnews.naver"
BASE = "https://finance.naver.com"


CACHE_TTL = timedelta(minutes=5)


class NaverMarketNewsRepository:
    """``mainnews.naver`` 페이지의 ``li.block1`` 리스트를 파싱."""

    def __init__(self) -> None:
        self._cache: tuple[datetime, list[MarketNewsItem]] | None = None

    async def fetch(self, limit: int = 20) -> list[MarketNewsItem]:
        if self._cache:
            cached_at, items = self._cache
            if datetime.now() - cached_at < CACHE_TTL:
                return items[:limit]

        items = await asyncio.to_thread(self._fetch_sync, limit)
        self._cache = (datetime.now(), items)
        return items

    def _fetch_sync(self, limit: int) -> list[MarketNewsItem]:
        try:
            from app.infrastructure.naver.http_session import get_session
            resp = get_session().get(MAIN_NEWS_URL, headers=HEADERS, timeout=10)
            resp.encoding = "euc-kr"
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as exc:  # noqa: BLE001
            logger.warning("naver mainnews fetch failed: %s", exc)
            return []

        items: list[MarketNewsItem] = []
        seen_headlines: set[str] = set()

        for li in soup.select("li.block1"):
            title_a = li.select_one("dd.articleSubject a")
            if not title_a:
                continue
            headline = title_a.get_text(strip=True)
            if not headline or headline in seen_headlines:
                continue
            seen_headlines.add(headline)

            href = title_a.get("href", "")
            full_url = urljoin(BASE, href) if href else ""

            summary_el = li.select_one("dd.articleSummary")
            summary = (
                summary_el.get_text(strip=True)[:140]
                if summary_el
                else ""
            )

            press_el = li.select_one(".press, .wdate")
            press = press_el.get_text(strip=True) if press_el else ""

            img_el = li.select_one("dt.thumb img")
            img_url = img_el.get("src", "") if img_el else ""

            items.append(
                MarketNewsItem(
                    id=hashlib.md5(headline.encode("utf-8")).hexdigest(),
                    headline=headline,
                    url=full_url,
                    summary=summary,
                    press=press,
                    image_url=img_url,
                    published_at=datetime.now(),
                )
            )
            if len(items) >= limit:
                break

        return items


_singleton: NaverMarketNewsRepository | None = None


def get_market_news_repository() -> NaverMarketNewsRepository:
    global _singleton
    if _singleton is None:
        _singleton = NaverMarketNewsRepository()
    return _singleton
