"""네이버 금융 종목별 외인/기관 매매 동향 크롤러.

``finance.naver.com/item/frgn.naver?code={symbol}`` 페이지의 두 번째
``table.type2`` 를 파싱. pykrx 의 투자자별 순매수 API 가 KRX 변경으로
빈 결과를 반환하는 이슈를 우회한다.

컬럼 순서:
  날짜, 종가, 전일비, 등락률, 거래량,
  기관 순매매량, 외국인 순매매량, 외인 보유주식, 외인 보유율
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from app.domain.entity.investor_flow import InvestorFlow, InvestorFlowDay

logger = logging.getLogger(__name__)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
}

FRGN_URL = "https://finance.naver.com/item/frgn.naver"


def _parse_int(text: str) -> int:
    cleaned = text.replace(",", "").replace("+", "").strip()
    if not cleaned or cleaned == "-":
        return 0
    try:
        return int(cleaned)
    except ValueError:
        return 0


def _parse_float(text: str) -> float | None:
    cleaned = text.replace(",", "").replace("+", "").replace("%", "").strip()
    if not cleaned or cleaned == "-":
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


class NaverInvestorFlowClient:
    async def get_flow(self, symbol: str, days: int = 10) -> InvestorFlow:
        return await asyncio.to_thread(self._fetch_sync, symbol, days)

    def _fetch_sync(self, symbol: str, days: int) -> InvestorFlow:
        try:
            from app.infrastructure.naver.rate_limiter import throttle
            from app.infrastructure.naver.http_session import get_session
            throttle()
            resp = get_session().get(
                FRGN_URL,
                params={"code": symbol},
                headers=HEADERS,
                timeout=10,
            )
            resp.encoding = "euc-kr"
            soup = BeautifulSoup(resp.text, "lxml")
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "naver frgn fetch failed for %s: %s", symbol, exc
            )
            return InvestorFlow(symbol=symbol)

        tables = soup.find_all("table", class_="type2")
        if len(tables) < 2:
            return InvestorFlow(symbol=symbol)

        table = tables[1]
        rows = table.find_all("tr")
        results: list[InvestorFlowDay] = []
        for row in rows:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 9 or not cells[0]:
                continue
            # 날짜 파싱 — "2026.04.15" 형태
            try:
                trade_date = datetime.strptime(cells[0], "%Y.%m.%d").date()
            except ValueError:
                continue

            close_price = _parse_int(cells[1])
            volume = _parse_int(cells[4])
            institution_net = _parse_int(cells[5])
            foreign_net = _parse_int(cells[6])
            foreign_holding_pct = _parse_float(cells[8])

            results.append(
                InvestorFlowDay(
                    trade_date=trade_date,
                    foreign_net=foreign_net,
                    institution_net=institution_net,
                    close_price=close_price,
                    volume=volume,
                    foreign_holding_pct=foreign_holding_pct,
                )
            )
            if len(results) >= days:
                break

        return InvestorFlow(symbol=symbol, days=results)


_singleton: NaverInvestorFlowClient | None = None


def get_investor_flow_client() -> NaverInvestorFlowClient:
    global _singleton
    if _singleton is None:
        _singleton = NaverInvestorFlowClient()
    return _singleton
