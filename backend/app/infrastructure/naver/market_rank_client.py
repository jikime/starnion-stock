"""네이버 금융 시장 랭킹/구성종목 페이지 스크래퍼.

다음 페이지의 HTML을 파싱하여 종목 심볼 리스트와 인기 랭킹을 제공한다:

1. 시가총액 순위 (``sise_market_sum.naver``) → market cap top N
2. 지수 구성 종목 (``entryJongmok.naver?code=KPI200`` / ``KOSDAQ150``) → index constituents
3. 거래대금/상승률/거래량 상위 (``sise_value/rise/quant.naver``) → hot stocks

pykrx 의 ``get_market_cap_by_ticker`` 및 ``get_index_portfolio_deposit_file``
이 KRX 웹 페이지 변경으로 실패하는 이슈를 우회한다.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

from app.infrastructure.naver.http_session import get_session as _get_session

logger = logging.getLogger(__name__)


@dataclass
class HotStockRow:
    """네이버 인기 랭킹 페이지에서 추출한 종목 row."""

    rank: int
    symbol: str
    name: str
    price: float
    change: float          # 전일비 절대값 (음수면 하락)
    change_pct: float      # 전일비 % (e.g. -1.23)
    volume: int            # 거래량 (주식 수)
    trade_value: int       # 거래대금 (단위: 천원)


# 네이버 인기 페이지 URL
# - sise_quant.naver = 거래상위 (default 정렬: 거래대금) → value/volume 둘 다 사용
# - sise_rise.naver  = 상승률 상위
HOT_PAGE_URLS: dict[str, str] = {
    "value": "https://finance.naver.com/sise/sise_quant.naver",
    "volume": "https://finance.naver.com/sise/sise_quant.naver",
    "change": "https://finance.naver.com/sise/sise_rise.naver",
    "fall": "https://finance.naver.com/sise/sise_fall.naver",
}


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://finance.naver.com/",
}


MARKET_SUM_URL = "https://finance.naver.com/sise/sise_market_sum.naver"
INDEX_ENTRY_URL = "https://finance.naver.com/sise/entryJongmok.naver"


# ``sosok=0`` → KOSPI, ``sosok=1`` → KOSDAQ
MARKET_SOSOK: dict[str, int] = {
    "KOSPI": 0,
    "KOSDAQ": 1,
}

# 네이버가 사용하는 index 코드
INDEX_CODES: dict[str, str] = {
    "KPI200": "코스피200",
    "KPI100": "코스피100",
    "KOSDAQ150": "코스닥150",
}


_CODE_RE = re.compile(r"code=(\d{6})")


class NaverMarketRankClient:
    """네이버 금융 순위 페이지 기반 종목 심볼 리스트 제공."""

    async def get_top_market_cap(
        self, market: str = "KOSPI", limit: int = 10
    ) -> list[str]:
        """시가총액 상위 N개 종목 코드.

        네이버의 시가총액 페이지는 페이지당 50개 종목을 반환. 필요한 개수에
        맞춰 필요한 만큼만 페이지를 순회하고, 제한도 HTML 파싱 양을 줄이기
        위해 limit 기반으로 조정한다.
        """

        return await asyncio.to_thread(self._get_top_market_cap_sync, market, limit)

    def _get_top_market_cap_sync(self, market: str, limit: int) -> list[str]:
        sosok = MARKET_SOSOK.get(market.upper(), 0)
        symbols: list[str] = []
        seen: set[str] = set()
        pages_needed = max(1, (limit + 49) // 50)

        for page in range(1, pages_needed + 1):
            try:
                resp = _get_session().get(
                    MARKET_SUM_URL,
                    params={"sosok": sosok, "page": page},
                    headers=HEADERS,
                    timeout=10,
                )
                resp.encoding = "euc-kr"
                soup = BeautifulSoup(resp.text, "lxml")
            except Exception as exc:  # noqa: BLE001
                logger.warning("naver market cap page %d failed: %s", page, exc)
                continue

            for link in soup.select("a.tltle"):
                href = link.get("href", "")
                match = _CODE_RE.search(href)
                if not match:
                    continue
                code = match.group(1)
                if code in seen:
                    continue
                seen.add(code)
                symbols.append(code)
                if len(symbols) >= limit:
                    return symbols

        return symbols

    async def get_index_constituents(
        self, index_code: str = "KPI200", limit: int = 30
    ) -> list[str]:
        """지수 구성종목 코드 상위 N개."""

        return await asyncio.to_thread(
            self._get_index_constituents_sync, index_code, limit
        )

    def _get_index_constituents_sync(
        self, index_code: str, limit: int
    ) -> list[str]:
        symbols: list[str] = []
        seen: set[str] = set()
        # KPI200 페이지 1만 사용해도 상위 10개 추출에 충분
        pages_needed = max(1, (limit + 19) // 20)

        for page in range(1, pages_needed + 1):
            try:
                resp = _get_session().get(
                    INDEX_ENTRY_URL,
                    params={"code": index_code, "page": page},
                    headers=HEADERS,
                    timeout=10,
                )
                resp.encoding = "euc-kr"
                soup = BeautifulSoup(resp.text, "lxml")
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "naver index %s page %d failed: %s", index_code, page, exc
                )
                continue

            for link in soup.select("table.type_1 a"):
                href = link.get("href", "")
                if "/item/main" not in href:
                    continue
                match = _CODE_RE.search(href)
                if not match:
                    continue
                code = match.group(1)
                if code in seen:
                    continue
                seen.add(code)
                symbols.append(code)
                if len(symbols) >= limit:
                    return symbols

        return symbols


    async def get_hot_stocks(
        self, metric: str = "value", market: str = "KOSPI", limit: int = 20
    ) -> list[HotStockRow]:
        """인기 랭킹 (거래대금/거래량/상승률) 상위 N개.

        ``metric``: ``value`` (거래대금) | ``volume`` (거래량) | ``change`` (상승률)
        ``market``: ``KOSPI`` | ``KOSDAQ``
        """

        return await asyncio.to_thread(
            self._get_hot_stocks_sync, metric, market, limit
        )

    def _get_hot_stocks_sync(
        self, metric: str, market: str, limit: int
    ) -> list[HotStockRow]:
        url = HOT_PAGE_URLS.get(metric)
        if not url:
            logger.warning("unknown hot-stock metric: %s", metric)
            return []

        sosok = MARKET_SOSOK.get(market.upper(), 0)
        rows_out: list[HotStockRow] = []

        try:
            resp = _get_session().get(
                url,
                params={"sosok": sosok},
                headers=HEADERS,
                timeout=10,
            )
            resp.encoding = "euc-kr"
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as exc:  # noqa: BLE001
            logger.warning("naver hot stocks (%s) failed: %s", metric, exc)
            return []

        table = soup.find("table", class_="type_2")
        if not table:
            return []

        # 데이터 행만 (a.tltle 가진 row)
        candidates: list[HotStockRow] = []
        for row in table.find_all("tr"):
            a = row.select_one("a.tltle")
            if not a:
                continue
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 7:
                continue

            href = a.get("href", "")
            m = _CODE_RE.search(href)
            if not m:
                continue
            symbol = m.group(1)
            name = a.get_text(strip=True)

            try:
                rank = int(cells[0])
                price = _to_number(cells[2])
                # 전일비 셀: "하락11" / "상승380" / "0" 형태
                change_text = cells[3]
                change = _parse_change(change_text)
                # 등락률 셀: "+5.24%" / "-1.23%"
                change_pct = _to_number(cells[4])
                # 실제 수치 검증 (대원전선 6540원/일거래 수십만주) 기준 cells[5] 가
                # 거래대금(천원), cells[6] 가 거래량(주). thead 라벨 순서와는 달라
                # 보이지만 tbody 출력 순서가 우선이라 본 매핑을 채택.
                trade_value = int(_to_number(cells[5]))
                volume = int(_to_number(cells[6]))
            except (ValueError, IndexError):
                continue

            candidates.append(
                HotStockRow(
                    rank=rank,
                    symbol=symbol,
                    name=name,
                    price=price,
                    change=change,
                    change_pct=change_pct,
                    volume=volume,
                    trade_value=trade_value,
                )
            )

        # metric 별 정렬 (네이버가 거래대금 기준 정렬했으니 volume 만 재정렬 필요)
        if metric == "volume":
            candidates.sort(key=lambda r: r.volume, reverse=True)
            # 재정렬 후 rank 갱신
            for i, c in enumerate(candidates, start=1):
                c.rank = i

        rows_out = candidates[:limit]
        return rows_out


# ── helpers ──────────────────────────────────────────────────────────────


def _to_number(text: str) -> float:
    """'1,234' / '+5.24%' / '-12.5' → float"""
    cleaned = (
        text.replace(",", "")
        .replace("%", "")
        .replace("+", "")
        .strip()
    )
    if not cleaned or cleaned == "-":
        return 0.0
    return float(cleaned)


def _parse_change(text: str) -> float:
    """'상승380' → 380.0 / '하락11' → -11.0 / '0' → 0.0"""
    if not text:
        return 0.0
    if "하락" in text:
        digits = text.replace("하락", "").replace(",", "").strip()
        return -_to_number(digits)
    if "상승" in text:
        digits = text.replace("상승", "").replace(",", "").strip()
        return _to_number(digits)
    return _to_number(text)


_singleton: NaverMarketRankClient | None = None


def get_naver_market_rank_client() -> NaverMarketRankClient:
    global _singleton
    if _singleton is None:
        _singleton = NaverMarketRankClient()
    return _singleton
