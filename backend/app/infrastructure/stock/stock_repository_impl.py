"""네이버 기반 StockRepository 구현체.

pykrx 는 2024년경 KRX 서버가 data.krx.co.kr 의 AJAX 엔드포인트 스키마를
변경하면서 대부분의 API 가 HTTP 400 을 반환하게 되어 제거됐다. 현재는
전적으로 네이버 금융 페이지 크롤링으로 대체되어 있다:

- 종목 마스터:      KRX KIND corpList (``KrxCorpListClient``)
- 현재가/OHLCV:     네이버 차트 API (``NaverChartClient``)
- 시장 지수:        네이버 지수 페이지 (``NaverIndexClient``)
- 펀더멘탈:         네이버 종목 메인 (``NaverFundamentalClient``)

모든 HTTP 호출은 ``asyncio.to_thread`` 로 래핑하여 이벤트 루프 블로킹 방지.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

import aiosqlite

from app.config import settings
from app.domain.entity.stock import Candle, Fundamental, Stock, StockPrice
from app.infrastructure.krx.corp_list_client import KrxCorpListClient
from app.infrastructure.naver.chart_client import NaverChartClient
from app.infrastructure.naver.fundamental_client import (
    NaverFundamentalClient,
)
from app.infrastructure.naver.index_client import NaverIndexClient

STOCK_MASTER_PATH = (
    Path(__file__).resolve().parents[3] / "data" / "stock_master.json"
)


# ── 한국 시장 장중 판별 ──────────────────────────────────────────────────
# KRX 정규장: 09:00 ~ 15:30 (KST=UTC+9)
# 장중이면 일봉도 5분 TTL 적용하여 실시간 갱신

from zoneinfo import ZoneInfo

_KST = ZoneInfo("Asia/Seoul")
_MARKET_OPEN = 9 * 60           # 09:00 → 540분
_MARKET_CLOSE = 15 * 60 + 30   # 15:30 → 930분
# 장중 일봉 캐시 TTL (5분) — 장 끝나면 영구 캐시
DAILY_MARKET_HOURS_TTL = timedelta(minutes=5)


def _is_kr_market_hours() -> bool:
    """현재 시각이 한국 장중(평일 09:00~15:30 KST)인지 판별."""

    now = datetime.now(_KST)
    # 토(5), 일(6) 휴장
    if now.weekday() >= 5:
        return False
    minutes = now.hour * 60 + now.minute
    return _MARKET_OPEN <= minutes <= _MARKET_CLOSE

logger = logging.getLogger(__name__)


# (pykrx 관련 헬퍼 _last_business_day, _format_date_range 는 제거됨)


class PykrxStockRepository:
    """StockRepository Protocol 구현 (이름은 유지, 내부는 전면 네이버 기반).

    종목 마스터 목록은 ``BackgroundScheduler`` 가 기동 시 + 24시간 주기로
    ``data/stock_master.json`` 에 저장하는 것을 읽어 사용한다. 이 레포지토리는
    네트워크 호출을 직접 수행하지 않고 JSON 파일만 읽어 지연을 최소화한다.
    파일이 없는 경우만 ``KrxCorpListClient`` 로 즉시 동기 다운로드를 수행하는
    폴백 경로가 있다 (첫 기동 직후 경쟁 조건 대응).
    """

    def __init__(self) -> None:
        self._stock_cache: list[Stock] | None = None
        self._stock_cache_mtime: float | None = None
        self._name_index: dict[str, str] = {}
        self._index_client = NaverIndexClient()
        self._chart_client = NaverChartClient()
        self._fundamental_client = NaverFundamentalClient()
        self._corp_list_client = KrxCorpListClient(cache_path=STOCK_MASTER_PATH)

    # ── Stock 마스터 ──────────────────────────────────────────────────────

    async def list_all(self) -> list[Stock]:
        # 1차: 메모리 캐시 (단, JSON 파일이 갱신되면 invalidate)
        current_mtime = self._current_mtime()
        if (
            self._stock_cache is not None
            and self._stock_cache_mtime == current_mtime
        ):
            return self._stock_cache

        # 2차: JSON 파일 로드
        result = await asyncio.to_thread(self._load_from_json)

        # 3차: 파일 없음 → KrxCorpListClient 로 즉시 동기 다운로드 (첫 기동 폴백)
        if not result:
            logger.info("stock master JSON missing, downloading now...")
            try:
                result = await self._corp_list_client.fetch_all(
                    force_refresh=True
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("KRX corpList fetch failed: %s", exc)
                result = []

        self._stock_cache = result
        self._stock_cache_mtime = current_mtime
        self._name_index = {s.symbol: s.name for s in result}
        return result

    def _current_mtime(self) -> float | None:
        try:
            return STOCK_MASTER_PATH.stat().st_mtime
        except (FileNotFoundError, OSError):
            return None

    def _load_from_json(self) -> list[Stock]:
        try:
            if not STOCK_MASTER_PATH.exists():
                return []
            with STOCK_MASTER_PATH.open("r", encoding="utf-8") as f:
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
            logger.warning("failed to load stock master JSON: %s", exc)
            return []

    async def search(self, query: str, limit: int = 20) -> list[Stock]:
        stocks = await self.list_all()
        q = query.strip().lower()
        if not q:
            return stocks[:limit]
        matches = [
            s
            for s in stocks
            if q in s.symbol.lower() or q in s.name.lower()
        ]
        return matches[:limit]

    # ── Price ────────────────────────────────────────────────────────────

    async def get_price(self, symbol: str) -> StockPrice | None:
        """현재가 조회 — 최근 2개 일봉을 기반으로 전일 대비 변동 계산.

        네이버 차트 API 로 최근 2 캔들 을 가져와 마지막 캔들 = 현재가,
        직전 캔들 = 전일 종가 로 change / change_pct 를 계산한다.
        종목명은 마스터 JSON 에서 조회 (없으면 symbol 그대로).
        """

        candles = await self._chart_client.get_candles(
            symbol, period="day", count=2
        )
        if not candles:
            return None
        last = candles[-1]
        prev = candles[-2] if len(candles) >= 2 else last
        change = last.close - prev.close
        change_pct = (change / prev.close * 100) if prev.close else 0.0

        # 이름 lookup — 마스터 캐시가 이미 로드됐으면 즉시, 아니면 symbol 반환
        name = self._name_index.get(symbol)
        if not name and not self._name_index:
            # lazy load (blocking-ish, JSON 파일 read 만 하면 빠름)
            try:
                await self.list_all()
                name = self._name_index.get(symbol)
            except Exception:  # noqa: BLE001
                pass
        if not name:
            name = symbol

        return StockPrice(
            symbol=symbol,
            name=name,
            current_price=last.close,
            change=change,
            change_pct=change_pct,
            volume=last.volume,
            updated_at=datetime.now(),
            price_type="stock",
        )

    # ── Candles ──────────────────────────────────────────────────────────

    async def get_candles(
        self,
        symbol: str,
        period: str = "day",
        count: int = 120,
        before: datetime | None = None,
    ) -> list[Candle]:
        """OHLCV 캔들 조회 (SQLite 캐시 우선).

        흐름:
        1. SQLite ``candles`` 테이블에서 조회 (TTL 정책 적용)
        2. 충분하면 즉시 반환
        3. 부족하면 네이버 차트 API (1차) / pykrx (2차) 호출
        4. 결과를 DB 에 UPSERT 후 반환

        TTL 정책:
          - 일/주봉: 영구 (확정값)
          - 1분/5분봉: 30초 (장중 재조회 허용)

        ``before`` 지정 시 해당 시각 이전 캔들만 반환 (pan 과거 로드용).
        """

        # 1. 캐시 조회
        cached = await _fetch_candles_from_cache(
            symbol, period, count, before
        )
        cache_sufficient = len(cached) >= count

        # 일/주봉: 캐시 수는 충분해도 두 가지 조건에서 재조회:
        # (a) 최신 캔들 날짜가 오늘 이전 → 오늘 데이터 없음
        # (b) 장중(09:00~15:30 KST)이면 5분마다 갱신 → 실시간 종가 반영
        period_l = period.lower()
        if (
            cache_sufficient
            and period_l not in INTRADAY_PERIODS
            and before is None
            and cached
        ):
            latest_date = cached[-1].time.date()
            today = datetime.now().date()
            if latest_date < today:
                # (a) 오늘 캔들이 아직 없음
                cache_sufficient = False
            elif _is_kr_market_hours():
                # (b) 장중: fetched_at 기준 5분 TTL
                fetched_at = await _get_latest_fetched_at(
                    symbol, period_l
                )
                if fetched_at is not None:
                    age = datetime.now() - fetched_at
                    if age > DAILY_MARKET_HOURS_TTL:
                        cache_sufficient = False

        if cache_sufficient:
            return cached[-count:]

        # 2. 원본 소스 호출 (네이버 차트 API) — 전 기간/분봉/일봉/주봉 모두 지원
        needed = max(count, len(cached) + count)
        candles = await self._chart_client.get_candles(
            symbol, period=period, count=needed
        )

        if not candles:
            return cached  # 캐시라도 반환

        # 3. DB 저장 (UPSERT)
        try:
            await _save_candles_to_cache(symbol, period, candles)
        except Exception as exc:  # noqa: BLE001
            logger.warning("candle cache save failed: %s", exc)

        # 4. before 필터 + count 제한
        if before is not None:
            candles = [c for c in candles if c.time < before]
        return candles[-count:]

    # ── Market indices ───────────────────────────────────────────────────

    async def get_market_indices(self) -> list[StockPrice]:
        """시장 지수 조회.

        과거에는 pykrx 의 ``get_index_ohlcv_by_date`` 를 1차 소스로 시도했지만
        KRX 웹페이지 변경으로 이 엔드포인트가 완전히 깨진 상태이며, 더욱이
        pykrx 내부의 ``logging.info(args, kwargs)`` 잘못된 호출이 매번 stderr
        로 트레이스백을 쏟아낸다. 네이버 금융 HTML 파싱이 안정적으로 동작
        하므로 pykrx 시도를 생략하고 바로 네이버 폴백을 사용한다.
        """

        return await self._index_client.get_market_indices()

    async def get_market_tickers(self, symbols: list[str]) -> list[StockPrice]:
        """여러 종목의 현재가를 한 번에 조회."""

        async def _one(sym: str) -> StockPrice | None:
            return await self.get_price(sym)

        results = await asyncio.gather(*[_one(s) for s in symbols])
        return [r for r in results if r is not None]

    # ── Fundamental (PER/PBR/EPS ...) ────────────────────────────────────

    async def get_fundamental(self, symbol: str) -> Fundamental | None:
        """네이버 종목 메인 페이지에서 PER/EPS/PBR/배당률 추출.

        BPS/DPS 는 네이버 메인에 직접 노출되지 않아 ``None`` 으로 둔다.
        필요 시 사업보고서(DART) 로 보강 가능.
        """

        snap = await self._fundamental_client.get_fundamental(symbol)
        if (
            snap.per is None
            and snap.pbr is None
            and snap.eps is None
            and snap.dividend_yield is None
        ):
            return None
        return Fundamental(
            symbol=symbol,
            per=snap.per,
            pbr=snap.pbr,
            eps=snap.eps,
            bps=None,
            div_yield=snap.dividend_yield,
            dps=None,
        )


# ── helpers ─────────────────────────────────────────────────────────────


# 분봉 TTL — 장중 재조회 허용
INTRADAY_PERIODS = {"1min", "5min", "15min", "30min", "60min"}
INTRADAY_TTL = timedelta(seconds=30)


async def _get_latest_fetched_at(
    symbol: str, period: str
) -> datetime | None:
    """해당 종목·주기의 가장 최근 fetched_at 타임스탬프 조회."""

    try:
        async with aiosqlite.connect(settings.db_path) as db:
            cursor = await db.execute(
                "SELECT MAX(fetched_at) FROM candles "
                "WHERE symbol = ? AND period = ?",
                (symbol, period),
            )
            row = await cursor.fetchone()
            if row and row[0]:
                return datetime.fromisoformat(row[0])
    except Exception:  # noqa: BLE001
        pass
    return None


async def _fetch_candles_from_cache(
    symbol: str,
    period: str,
    count: int,
    before: datetime | None,
) -> list[Candle]:
    """SQLite candles 캐시 조회. TTL 체크 + before 범위 제한."""

    period_l = period.lower()
    before_iso = before.isoformat() if before else None
    ttl_cutoff: str | None = None
    if period_l in INTRADAY_PERIODS:
        ttl_cutoff = (datetime.now() - INTRADAY_TTL).isoformat()

    sql = (
        "SELECT ts, open, high, low, close, volume FROM candles "
        "WHERE symbol = ? AND period = ?"
    )
    params: list = [symbol, period_l]
    if before_iso:
        sql += " AND ts < ?"
        params.append(before_iso)
    if ttl_cutoff:
        sql += " AND fetched_at >= ?"
        params.append(ttl_cutoff)
    sql += " ORDER BY ts DESC LIMIT ?"
    params.append(count)

    try:
        async with aiosqlite.connect(settings.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(sql, params)
            rows = await cursor.fetchall()
    except Exception as exc:  # noqa: BLE001
        logger.warning("candle cache fetch failed: %s", exc)
        return []

    # DESC 로 뽑았으니 시간 오름차순으로 뒤집기
    result: list[Candle] = []
    for row in reversed(rows):
        try:
            ts = datetime.fromisoformat(row["ts"])
        except (ValueError, TypeError):
            continue
        result.append(
            Candle(
                time=ts,
                open=float(row["open"]),
                high=float(row["high"]),
                low=float(row["low"]),
                close=float(row["close"]),
                volume=int(row["volume"]),
            )
        )
    return result


async def _save_candles_to_cache(
    symbol: str,
    period: str,
    candles: list[Candle],
) -> None:
    """DB 에 INSERT OR REPLACE — 최신 OHLC 로 덮어쓰기."""

    if not candles:
        return

    period_l = period.lower()
    fetched_at = datetime.now().isoformat()
    rows = [
        (
            symbol,
            period_l,
            c.time.isoformat(),
            float(c.open),
            float(c.high),
            float(c.low),
            float(c.close),
            int(c.volume),
            fetched_at,
        )
        for c in candles
    ]
    async with aiosqlite.connect(settings.db_path) as db:
        await db.executemany(
            """
            INSERT OR REPLACE INTO candles
                (symbol, period, ts, open, high, low, close, volume, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        await db.commit()


# (pykrx DataFrame 파싱용 헬퍼 _to_datetime, _safe_float 는 제거됨)


@lru_cache(maxsize=1)
def get_pykrx_stock_repository() -> PykrxStockRepository:
    return PykrxStockRepository()
