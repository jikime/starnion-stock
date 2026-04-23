"""dart-fss 라이브러리 기반 DisclosureRepository 구현.

참고: ``mcp-opendart-server/opendarts.py`` 의 ``_year_quarter()``,
``fetch_corp_code()`` 패턴을 재활용 (Python 함수로 이식).
"""

import asyncio
import logging
from datetime import datetime, timedelta
from functools import lru_cache

import dart_fss as dart

from app.config import settings
from app.domain.entity.disclosure import Disclosure, DividendInfo

logger = logging.getLogger(__name__)


DART_VIEWER_BASE = "https://dart.fss.or.kr/dsaf001/main.do"


def _year_quarter(
    year: int | None = None, quarter: int | None = None
) -> tuple[int, int]:
    """mcp-opendart-server/opendarts.py:_year_quarter 재현.

    파라미터가 None이면 현재 시점 기준 직전 분기를 반환.
    """

    now = datetime.now()
    q = (now.month - 1) // 3  # 0: 1Q 미완료
    default_year, default_quarter = (
        (now.year - 1, 4) if q == 0 else (now.year, q)
    )
    year = year or default_year
    quarter = quarter or (4 if year < now.year else default_quarter)
    return year, quarter


def _classify(report_nm: str) -> str:
    """공시명으로 카테고리 추정."""

    if "배당" in report_nm:
        return "배당"
    if "유상증자" in report_nm or "유증" in report_nm:
        return "유증"
    if "자기주식" in report_nm or "자사주" in report_nm:
        return "자사주"
    if (
        "분기보고서" in report_nm
        or "반기보고서" in report_nm
        or "사업보고서" in report_nm
    ):
        return "정기"
    if "주요사항" in report_nm:
        return "주요"
    return "공시"


class DartDisclosureRepository:
    """DisclosureRepository Protocol 구현."""

    def __init__(self) -> None:
        dart.set_api_key(api_key=settings.dart_api_key)
        self._corp_list = None  # lazy initialize (22MB 다운로드)

    def _get_corp(self, symbol: str):
        if self._corp_list is None:
            logger.info("Loading DART corp list (may take a while on first call)...")
            self._corp_list = dart.get_corp_list()
        try:
            found = self._corp_list.find_by_stock_code(symbol)
            return found
        except Exception as exc:  # noqa: BLE001
            logger.warning("DART corp lookup failed for %s: %s", symbol, exc)
            return None

    # ── Disclosures ───────────────────────────────────────────────────

    async def list_recent(self, symbol: str, days: int = 30) -> list[Disclosure]:
        return await asyncio.to_thread(self._list_recent_sync, symbol, days)

    def _list_recent_sync(self, symbol: str, days: int) -> list[Disclosure]:
        corp = self._get_corp(symbol)
        if corp is None:
            return []

        end = datetime.now()
        start = end - timedelta(days=days)
        bgn_de = start.strftime("%Y%m%d")
        end_de = end.strftime("%Y%m%d")

        try:
            search_result = corp.search_filings(bgn_de=bgn_de, end_de=end_de)
        except Exception as exc:  # noqa: BLE001
            logger.warning("DART search_filings failed for %s: %s", symbol, exc)
            return []

        disclosures: list[Disclosure] = []
        reports = getattr(search_result, "report_list", None) or list(search_result)
        for report in reports:
            report_nm = getattr(report, "report_nm", "") or ""
            rcept_no = getattr(report, "rcept_no", "") or ""
            rcept_dt = getattr(report, "rcept_dt", "") or ""
            corp_name = getattr(report, "corp_name", "") or ""
            corp_code = getattr(report, "corp_code", "") or ""

            disclosures.append(
                Disclosure(
                    rcept_no=rcept_no,
                    corp_code=corp_code,
                    corp_name=corp_name,
                    report_nm=report_nm,
                    rcept_dt=rcept_dt,
                    category=_classify(report_nm),
                    summary="",
                    url=f"{DART_VIEWER_BASE}?rcpNo={rcept_no}",
                )
            )
        return disclosures

    # ── Market-wide disclosures (대시보드용) ──────────────────────────

    async def list_all_recent(
        self, days: int = 1, limit: int = 30
    ) -> list[Disclosure]:
        """전 종목 최근 N일 공시 — 종목 필터 없음."""

        return await asyncio.to_thread(self._list_all_recent_sync, days, limit)

    def _list_all_recent_sync(
        self, days: int, limit: int
    ) -> list[Disclosure]:
        end = datetime.now()
        start = end - timedelta(days=days)
        bgn_de = start.strftime("%Y%m%d")
        end_de = end.strftime("%Y%m%d")

        try:
            from dart_fss.filings import search

            # search() 는 corp_code 없이 호출하면 전체 공시 검색.
            # page_count 는 한 페이지당 결과 개수 (최대 100).
            search_result = search(
                bgn_de=bgn_de,
                end_de=end_de,
                page_count=min(100, max(limit, 30)),
                last_reprt_at="N",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("DART list_all_recent failed: %s", exc)
            return []

        disclosures: list[Disclosure] = []
        reports = (
            getattr(search_result, "report_list", None)
            or list(search_result)
        )
        for report in reports:
            report_nm = getattr(report, "report_nm", "") or ""
            rcept_no = getattr(report, "rcept_no", "") or ""
            rcept_dt = getattr(report, "rcept_dt", "") or ""
            corp_name = getattr(report, "corp_name", "") or ""
            corp_code = getattr(report, "corp_code", "") or ""

            disclosures.append(
                Disclosure(
                    rcept_no=rcept_no,
                    corp_code=corp_code,
                    corp_name=corp_name,
                    report_nm=report_nm,
                    rcept_dt=rcept_dt,
                    category=_classify(report_nm),
                    summary="",
                    url=f"{DART_VIEWER_BASE}?rcpNo={rcept_no}",
                )
            )
            if len(disclosures) >= limit:
                break

        return disclosures

    # ── Dividends ────────────────────────────────────────────────────

    async def get_dividends(
        self, symbol: str, year: int | None = None
    ) -> list[DividendInfo]:
        return await asyncio.to_thread(self._get_dividends_sync, symbol, year)

    def _get_dividends_sync(
        self, symbol: str, year: int | None
    ) -> list[DividendInfo]:
        corp = self._get_corp(symbol)
        if corp is None:
            return []

        target_year, target_quarter = _year_quarter(year, None)

        try:
            corp_code = getattr(corp, "corp_code", None)
            if not corp_code:
                return []
            # dart_fss.api.finance.alot_matter 가 배당 관련 정보 반환
            from dart_fss.api.finance import alot_matter

            reprt_code = _reprt_code(target_quarter)
            df = alot_matter(corp_code, bsns_year=str(target_year), reprt_code=reprt_code)
        except Exception as exc:  # noqa: BLE001
            logger.warning("DART alot_matter failed for %s: %s", symbol, exc)
            return []

        if df is None or (hasattr(df, "empty") and df.empty):
            return []

        results: list[DividendInfo] = []
        # DART 배당 테이블은 여러 항목을 포함. 각 행에서 주요 값만 추출.
        try:
            rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else list(df)
        except Exception:  # noqa: BLE001
            rows = []

        info = DividendInfo(
            symbol=symbol,
            year=target_year,
            quarter=target_quarter,
        )
        for row in rows:
            account = str(row.get("se", "")) if isinstance(row, dict) else ""
            value = row.get("thstrm", "") if isinstance(row, dict) else ""
            num = _safe_number(value)
            if "주당 현금배당금" in account or "1주당 현금배당금" in account:
                info.dividend_per_share = num
            elif "현금배당수익률" in account:
                info.dividend_yield = num
            elif "현금배당금총액" in account or "현금배당총액" in account:
                info.dividend_total = num
            elif "현금배당성향" in account:
                info.payout_ratio = num
        results.append(info)
        return results


# ── helpers ──────────────────────────────────────────────────────────────


def _reprt_code(quarter: int) -> str:
    """분기 → 보고서 코드. 1Q=11013, 반기=11012, 3Q=11014, 사업=11011"""

    mapping = {1: "11013", 2: "11012", 3: "11014", 4: "11011"}
    return mapping.get(quarter, "11011")


def _safe_number(value) -> float | None:
    if value is None or value == "":
        return None
    text = str(value).replace(",", "").replace("%", "").strip()
    if text in ("-", ""):
        return None
    try:
        return float(text)
    except ValueError:
        return None


@lru_cache(maxsize=1)
def get_dart_disclosure_repository() -> DartDisclosureRepository:
    return DartDisclosureRepository()
