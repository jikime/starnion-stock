"""KRX 공식 상장법인 목록 클라이언트.

KIND (한국거래소 기업공시채널) 의 ``corpgeneral/corpList.do`` 엔드포인트는
HTML 테이블 형식으로 전체 KOSPI/KOSDAQ 상장 법인 목록을 제공한다. pykrx 의
``get_market_ticker_list`` 가 KRX 웹 페이지 변경으로 실패하는 이슈를 우회하기
위해 이 엔드포인트를 1차 소스로 사용한다.

데이터 볼륨이 크지 않으므로(약 2,600 종목) 서버 기동 시 1회 다운로드 후
메모리에 캐시하고, 디스크(``data/stock_master.json``) 에도 저장하여 다음
기동을 빠르게 한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from app.domain.entity.stock import Stock

logger = logging.getLogger(__name__)

KIND_URL = (
    "http://kind.krx.co.kr/corpgeneral/corpList.do"
    "?method=download&marketType={market}"
)

MARKETS: dict[str, str] = {
    "stockMkt": "KOSPI",
    "kosdaqMkt": "KOSDAQ",
}


def _pad_ticker(value) -> str:
    """KRX 엑셀 응답의 종목코드는 선행 0이 잘려 있는 경우가 있어 보정한다."""

    s = str(value).strip()
    if s.endswith(".0"):
        s = s[:-2]
    return s.zfill(6)


class KrxCorpListClient:
    """KRX corpList.do HTML 다운로드 & 캐시 래퍼."""

    def __init__(
        self,
        cache_path: Path,
        cache_ttl: timedelta = timedelta(hours=24),
    ) -> None:
        self.cache_path = cache_path
        self.cache_ttl = cache_ttl

    async def fetch_all(self, force_refresh: bool = False) -> list[Stock]:
        """메모리 캐시는 repository 레이어에서 관리. 이 메서드는 디스크 캐시
        확인 후 필요시 네트워크 페치."""

        if not force_refresh:
            cached = self._load_cache()
            if cached:
                return cached

        return await asyncio.to_thread(self._download_and_cache)

    # ── Internals ─────────────────────────────────────────────────────

    def _load_cache(self) -> list[Stock] | None:
        try:
            if not self.cache_path.exists():
                return None
            age = datetime.now().timestamp() - self.cache_path.stat().st_mtime
            if age > self.cache_ttl.total_seconds():
                logger.info(
                    "stock master cache expired (%.1f h old)", age / 3600
                )
                return None
            with self.cache_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            return [
                Stock(
                    symbol=item["symbol"],
                    name=item["name"],
                    market=item["market"],
                    sector=item.get("sector", ""),
                )
                for item in data
            ]
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to load stock master cache: %s", exc)
            return None

    def _download_and_cache(self) -> list[Stock]:
        stocks: list[Stock] = []
        for market_code, market_label in MARKETS.items():
            logger.info("fetching KRX %s corp list", market_label)
            df = self._fetch_dataframe(market_code)
            if df is None or df.empty:
                continue
            for _, row in df.iterrows():
                name = str(row.get("회사명", "")).strip()
                code = _pad_ticker(row.get("종목코드", ""))
                sector = str(row.get("업종", "") or "").strip()
                if not name or not code:
                    continue
                stocks.append(
                    Stock(
                        symbol=code,
                        name=name,
                        market=market_label,
                        sector=sector,
                    )
                )

        if stocks:
            self._save_cache(stocks)
            logger.info(
                "downloaded %d stocks from KRX, cached to %s",
                len(stocks),
                self.cache_path,
            )
        return stocks

    def _fetch_dataframe(self, market_code: str) -> pd.DataFrame | None:
        url = KIND_URL.format(market=market_code)
        try:
            # pandas read_html 은 bs4 UserWarning 을 발생시켜 로그가 지저분해짐
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dfs = pd.read_html(url, encoding="euc-kr")
            return dfs[0] if dfs else None
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "KRX corp list fetch failed for %s: %s", market_code, exc
            )
            return None

    def _save_cache(self, stocks: list[Stock]) -> None:
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            payload = [
                {
                    "symbol": s.symbol,
                    "name": s.name,
                    "market": s.market,
                    "sector": s.sector,
                }
                for s in stocks
            ]
            with self.cache_path.open("w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to save stock master cache: %s", exc)
