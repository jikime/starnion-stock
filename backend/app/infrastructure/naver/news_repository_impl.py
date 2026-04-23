"""네이버 금융 뉴스 크롤러 기반 NewsRepository 구현."""

import asyncio
import hashlib
import logging
import re
from datetime import datetime
from functools import lru_cache
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.domain.entity.news import NewsItem, Sentiment

logger = logging.getLogger(__name__)


NEWS_URL = "https://finance.naver.com/item/news_news.naver"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://finance.naver.com/",
}


class NaverNewsRepository:
    """NewsRepository Protocol 구현."""

    async def fetch_by_symbol(self, symbol: str, limit: int = 10) -> list[NewsItem]:
        return await asyncio.to_thread(self._fetch_sync, symbol, limit)

    def _fetch_sync(self, symbol: str, limit: int) -> list[NewsItem]:
        try:
            from app.infrastructure.naver.rate_limiter import throttle
            from app.infrastructure.naver.http_session import get_session
            throttle()
            params = {"code": symbol, "page": 1}
            resp = get_session().get(
                NEWS_URL, params=params, headers=HEADERS, timeout=10
            )
            # 네이버 금융은 euc-kr 인코딩
            resp.encoding = resp.apparent_encoding or "euc-kr"
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as exc:  # noqa: BLE001
            logger.warning("naver news fetch failed for %s: %s", symbol, exc)
            return []

        items: list[NewsItem] = []
        seen_ids: set[str] = set()
        rows = soup.select("table.type5 tr")

        for row in rows:
            title_el = row.select_one("td.title a") or row.select_one(".title a")
            if not title_el:
                continue
            headline = _clean_text(title_el.get_text())
            if not headline:
                continue

            href = title_el.get("href") or ""
            url = urljoin("https://finance.naver.com", href)

            source_el = row.select_one("td.info") or row.select_one(".info")
            source = _clean_text(source_el.get_text()) if source_el else ""

            date_el = row.select_one("td.date") or row.select_one(".date")
            published_at = _parse_date(_clean_text(date_el.get_text())) if date_el else None

            # 네이버 뉴스 리스트는 "관련 기사" 묶음으로 같은 URL/제목이
            # 여러 번 나타나는 경우가 있어 id 기준으로 dedup 한다.
            news_id = hashlib.md5(
                f"{symbol}-{headline}-{url}".encode("utf-8")
            ).hexdigest()
            if news_id in seen_ids:
                continue
            seen_ids.add(news_id)

            hour = published_at.hour if published_at else datetime.now().hour

            items.append(
                NewsItem(
                    id=news_id,
                    symbol=symbol,
                    headline=headline,
                    source=source,
                    url=url,
                    sentiment=Sentiment.NEUTRAL,
                    impact="Moderate",
                    keywords=[],
                    published_at=published_at,
                    hour=hour,
                )
            )
            if len(items) >= limit:
                break

        return items


# ── helpers ──────────────────────────────────────────────────────────────


_WHITESPACE_RE = re.compile(r"\s+")


def _clean_text(text: str) -> str:
    if not text:
        return ""
    return _WHITESPACE_RE.sub(" ", text).strip()


def _parse_date(text: str) -> datetime | None:
    """네이버 뉴스 날짜 문자열을 파싱. 포맷 예: '2026.04.15 10:32'."""

    if not text:
        return None
    for fmt in ("%Y.%m.%d %H:%M", "%Y-%m-%d %H:%M", "%Y.%m.%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


@lru_cache(maxsize=1)
def get_naver_news_repository() -> NaverNewsRepository:
    return NaverNewsRepository()
