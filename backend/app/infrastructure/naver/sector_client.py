"""네이버 금융 업종(섹터) 크롤러.

``finance.naver.com/sise/sise_group.naver?type=upjong`` 페이지 파싱.

컬럼 순서:
  업종명, 등락률, 전체, 상승, 하락, 보합, 외인보유율
"""

from __future__ import annotations

import asyncio
import logging

import requests
from bs4 import BeautifulSoup

from app.domain.entity.sector import SectorRank

logger = logging.getLogger(__name__)


URL = "https://finance.naver.com/sise/sise_group.naver"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://finance.naver.com/",
}


def _parse_pct(text: str) -> float:
    cleaned = text.replace("%", "").replace("+", "").replace(",", "").strip()
    if not cleaned or cleaned == "-":
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_int(text: str) -> int:
    cleaned = text.replace(",", "").strip()
    if not cleaned or cleaned == "-":
        return 0
    try:
        return int(cleaned)
    except ValueError:
        return 0


class NaverSectorClient:
    async def get_sectors(self) -> list[SectorRank]:
        return await asyncio.to_thread(self._fetch_sync)

    def _fetch_sync(self) -> list[SectorRank]:
        try:
            from app.infrastructure.naver.rate_limiter import throttle
            from app.infrastructure.naver.http_session import get_session

            throttle()
            resp = get_session().get(
                URL,
                params={"type": "upjong"},
                headers=HEADERS,
                timeout=10,
            )
            resp.encoding = "euc-kr"
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as exc:  # noqa: BLE001
            logger.warning("naver sectors fetch failed: %s", exc)
            return []

        table = soup.find("table", class_="type_1")
        if not table:
            return []

        results: list[SectorRank] = []
        for row in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 6 or not cells[0]:
                continue
            link = row.find("a")
            if not link:
                continue

            try:
                name = cells[0]
                change_pct = _parse_pct(cells[1])
                total = _parse_int(cells[2])
                up = _parse_int(cells[3])
                down = _parse_int(cells[4])
                flat = _parse_int(cells[5])
            except (ValueError, IndexError):
                continue

            results.append(
                SectorRank(
                    name=name,
                    change_pct=change_pct,
                    total_count=total,
                    up_count=up,
                    down_count=down,
                    flat_count=flat,
                )
            )

        # 등락률 내림차순
        results.sort(key=lambda r: r.change_pct, reverse=True)
        return results


_singleton: NaverSectorClient | None = None


def get_naver_sector_client() -> NaverSectorClient:
    global _singleton
    if _singleton is None:
        _singleton = NaverSectorClient()
    return _singleton
