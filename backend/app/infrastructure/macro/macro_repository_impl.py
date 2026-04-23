"""거시경제 지표 수집 — FinanceDataReader 기반.

지표:
- USD/KRW 원달러 환율
- KS11 코스피 지수 (TickerBar 와 중복되지만 매크로 패널에서 일관성 유지)
- VIX  미국 변동성 지수
- CL=F WTI 원유 선물
- FNG  공포·탐욕 지수 (VIX 기반 근사값)

FDR 호출은 동기 I/O 라 ``asyncio.to_thread`` 로 감싼다. 5분 in-memory 캐시.
``docs/05`` 의 데이터 수집 경로와 ``docs/09`` 의 매크로 변수 목록을 따른다.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

import FinanceDataReader as fdr

from app.domain.entity.macro import MacroIndicator, MacroSnapshot

logger = logging.getLogger(__name__)


CACHE_TTL = timedelta(minutes=5)


_INDICATORS: list[tuple[str, str]] = [
    # (FDR 코드, 한국어 라벨)
    ("USD/KRW", "원/달러"),
    ("KS11", "코스피"),
    ("VIX", "VIX"),
    ("CL=F", "WTI 유가"),
]


class FdrMacroRepository:
    """FinanceDataReader + VIX 기반 Fear&Greed 근사 산출."""

    def __init__(self) -> None:
        self._cache: tuple[datetime, MacroSnapshot] | None = None

    async def get_snapshot(self) -> MacroSnapshot:
        # in-memory 캐시
        if self._cache:
            cached_at, snapshot = self._cache
            if datetime.now() - cached_at < CACHE_TTL:
                return snapshot

        snapshot = await asyncio.to_thread(self._fetch_sync)
        self._cache = (datetime.now(), snapshot)
        return snapshot

    def _fetch_sync(self) -> MacroSnapshot:
        end = datetime.now()
        start = end - timedelta(days=10)  # 주말/공휴일 대비

        indicators: list[MacroIndicator] = []
        vix_value: float | None = None

        for code, label in _INDICATORS:
            try:
                df = fdr.DataReader(
                    code,
                    start.strftime("%Y-%m-%d"),
                    end.strftime("%Y-%m-%d"),
                )
                if df.empty or len(df) < 2:
                    logger.warning("FDR %s returned <2 rows", code)
                    continue
                last = float(df["Close"].iloc[-1])
                prev = float(df["Close"].iloc[-2])
                change = last - prev
                change_pct = (change / prev * 100) if prev else 0.0
                indicators.append(
                    MacroIndicator(
                        code=code,
                        label=label,
                        value=round(last, 2),
                        change=round(change, 2),
                        change_pct=round(change_pct, 2),
                    )
                )
                if code == "VIX":
                    vix_value = last
            except Exception as exc:  # noqa: BLE001
                logger.warning("FDR %s failed: %s", code, exc)

        # Fear & Greed 근사값 (VIX 역상관)
        # VIX < 12: Extreme Greed (90)
        # VIX 12-18: Greed (70)
        # VIX 18-25: Neutral (50)
        # VIX 25-35: Fear (30)
        # VIX > 35: Extreme Fear (10)
        if vix_value is not None:
            fng_score = _vix_to_fng(vix_value)
            indicators.append(
                MacroIndicator(
                    code="FNG",
                    label="공포·탐욕",
                    value=fng_score,
                    change=0.0,
                    change_pct=0.0,
                )
            )

        risk_level, summary = _evaluate_risk(indicators, vix_value)

        return MacroSnapshot(
            indicators=indicators,
            risk_level=risk_level,
            risk_summary=summary,
            fetched_at=datetime.now(),
        )


# ── helpers ──────────────────────────────────────────────────────────────


def _vix_to_fng(vix: float) -> float:
    """VIX → Fear&Greed 0~100 (역상관)."""

    if vix < 12:
        return 90.0
    if vix < 18:
        return 70.0
    if vix < 25:
        return 50.0
    if vix < 35:
        return 30.0
    return 10.0


def _evaluate_risk(
    indicators: list[MacroIndicator], vix: float | None
) -> tuple[str, str]:
    """4개 지표를 종합하여 ``(risk_level, summary)`` 반환.

    매우 단순한 룰 — VIX + USD/KRW 변동률 기준. 정교화는 후속 작업.
    """

    fx_pct = next(
        (i.change_pct for i in indicators if i.code == "USD/KRW"), 0.0
    )

    vix_disp = f"{vix:.1f}" if vix is not None else "n/a"

    if (vix is not None and vix > 25) or fx_pct > 1.0:
        return (
            "high",
            f"변동성 확대(VIX {vix_disp}, 환율 {fx_pct:+.2f}%) — 보수적 접근 권장",
        )
    if (vix is not None and vix > 18) or abs(fx_pct) > 0.5:
        return (
            "mid",
            f"중립적 시장(VIX {vix_disp}, 환율 {fx_pct:+.2f}%) — 평소 전략 유지",
        )
    return (
        "low",
        f"안정적 시장(VIX {vix_disp}) — 매수 우호 환경",
    )


_singleton: FdrMacroRepository | None = None


def get_macro_repository() -> FdrMacroRepository:
    global _singleton
    if _singleton is None:
        _singleton = FdrMacroRepository()
    return _singleton
