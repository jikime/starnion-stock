"""기술적 지표 계산기.

Candles 엔티티를 받아 ``ta`` 라이브러리로 RSI/MACD/BB/SMA/Stochastic/
Williams %R/CCI/ADX 를 일괄 계산하여 Indicators 엔티티를 반환한다.

Note: 과거 계획서에는 pandas-ta 를 사용했으나, Python 3.13 + numba 의 호환
문제로 ``ta`` 라이브러리로 대체되었다. 기능은 동등하다.
"""

from __future__ import annotations

import logging
from functools import lru_cache

import pandas as pd
from ta.momentum import RSIIndicator, StochasticOscillator, WilliamsRIndicator
from ta.trend import ADXIndicator, CCIIndicator, MACD, SMAIndicator
from ta.volatility import BollingerBands

from app.domain.entity.indicator import Indicators
from app.domain.entity.stock import Candle

logger = logging.getLogger(__name__)


class IndicatorCalculator:
    """Candles → Indicators."""

    def calculate_all(self, candles: list[Candle]) -> Indicators:
        if not candles:
            return Indicators()

        df = pd.DataFrame(
            [
                {
                    "open": c.open,
                    "high": c.high,
                    "low": c.low,
                    "close": c.close,
                    "volume": c.volume,
                }
                for c in candles
            ]
        )

        result = Indicators()

        # ── 이동평균 (SMA)
        result.sma5 = _last_or_none(SMAIndicator(df["close"], window=5).sma_indicator())
        result.sma20 = _last_or_none(SMAIndicator(df["close"], window=20).sma_indicator())
        if len(df) >= 50:
            result.sma50 = _last_or_none(SMAIndicator(df["close"], window=50).sma_indicator())
        if len(df) >= 60:
            result.sma60 = _last_or_none(SMAIndicator(df["close"], window=60).sma_indicator())
        if len(df) >= 120:
            result.sma120 = _last_or_none(SMAIndicator(df["close"], window=120).sma_indicator())
        if len(df) >= 200:
            result.sma200 = _last_or_none(SMAIndicator(df["close"], window=200).sma_indicator())

        # ── RSI (14)
        try:
            rsi = RSIIndicator(df["close"], window=14).rsi()
            result.rsi14 = _last_or_none(rsi)
        except Exception as exc:  # noqa: BLE001
            logger.warning("RSI calc failed: %s", exc)

        # ── MACD (12, 26, 9)
        try:
            macd = MACD(df["close"], window_slow=26, window_fast=12, window_sign=9)
            result.macd = _last_or_none(macd.macd())
            result.macd_signal = _last_or_none(macd.macd_signal())
            result.macd_hist = _last_or_none(macd.macd_diff())
        except Exception as exc:  # noqa: BLE001
            logger.warning("MACD calc failed: %s", exc)

        # ── Bollinger Bands (20, 2)
        try:
            bb = BollingerBands(df["close"], window=20, window_dev=2)
            result.bb_upper = _last_or_none(bb.bollinger_hband())
            result.bb_middle = _last_or_none(bb.bollinger_mavg())
            result.bb_lower = _last_or_none(bb.bollinger_lband())
        except Exception as exc:  # noqa: BLE001
            logger.warning("Bollinger calc failed: %s", exc)

        # ── Stochastic (14, 3)
        try:
            stoch = StochasticOscillator(
                df["high"], df["low"], df["close"], window=14, smooth_window=3
            )
            result.stoch_k = _last_or_none(stoch.stoch())
            result.stoch_d = _last_or_none(stoch.stoch_signal())
        except Exception as exc:  # noqa: BLE001
            logger.warning("Stochastic calc failed: %s", exc)

        # ── Williams %R (14)
        try:
            willr = WilliamsRIndicator(df["high"], df["low"], df["close"], lbp=14)
            result.williams_r = _last_or_none(willr.williams_r())
        except Exception as exc:  # noqa: BLE001
            logger.warning("Williams %R calc failed: %s", exc)

        # ── CCI (20)
        try:
            cci = CCIIndicator(df["high"], df["low"], df["close"], window=20)
            result.cci = _last_or_none(cci.cci())
        except Exception as exc:  # noqa: BLE001
            logger.warning("CCI calc failed: %s", exc)

        # ── ADX (14)
        try:
            adx = ADXIndicator(df["high"], df["low"], df["close"], window=14)
            result.adx = _last_or_none(adx.adx())
        except Exception as exc:  # noqa: BLE001
            logger.warning("ADX calc failed: %s", exc)

        # ── VWAP (docs/01) ─────────────────────────────────────────────
        # 누적 typical price × volume / 누적 volume.
        # 전체 윈도우 기준. 세력 평균 단가 추정치.
        try:
            typical = (df["high"] + df["low"] + df["close"]) / 3.0
            cum_tpv = (typical * df["volume"]).cumsum()
            cum_vol = df["volume"].cumsum()
            vwap_series = cum_tpv / cum_vol.replace(0, float("nan"))
            result.vwap = _last_or_none(vwap_series)
        except Exception as exc:  # noqa: BLE001
            logger.warning("VWAP calc failed: %s", exc)

        # ── Volume ratio (docs/01) — 현재 거래량 / 20일 평균 ────────────
        try:
            if len(df) >= 21:
                recent = float(df["volume"].iloc[-1])
                avg20 = float(df["volume"].iloc[-21:-1].mean())
                if avg20 > 0:
                    result.volume_ratio = recent / avg20
        except Exception as exc:  # noqa: BLE001
            logger.warning("volume_ratio calc failed: %s", exc)

        # 마지막 종가 — BB 하단 돌파/VWAP 조건 비교용
        result.close_price = float(df["close"].iloc[-1])

        # ── Pivot Point (docs/02 리버모어 — 전환점 돌파) ────────────────
        # Classic 피벗: 전일 H/L/C 기준
        #   P = (H + L + C) / 3
        #   R1 = 2P - L    (1차 저항)
        #   S1 = 2P - H    (1차 지지)
        try:
            if len(df) >= 2:
                prev = df.iloc[-2]
                p = (
                    float(prev["high"])
                    + float(prev["low"])
                    + float(prev["close"])
                ) / 3.0
                result.pivot = p
                result.pivot_r1 = 2 * p - float(prev["low"])
                result.pivot_s1 = 2 * p - float(prev["high"])
        except Exception as exc:  # noqa: BLE001
            logger.warning("pivot calc failed: %s", exc)

        return result


def _last_or_none(series) -> float | None:
    try:
        val = series.iloc[-1]
        if pd.isna(val):
            return None
        return float(val)
    except (IndexError, AttributeError, ValueError):
        return None


@lru_cache(maxsize=1)
def get_indicator_calculator() -> IndicatorCalculator:
    return IndicatorCalculator()
