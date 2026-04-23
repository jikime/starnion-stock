"""스윙 포인트 기반 지지/저항 레벨 탐지기.

접근 방식:
1. 120봉 OHLCV 에서 ``window=5`` 로 로컬 최저/최고점(스윙 하이/로우)을 찾는다.
2. 스윙 가격들을 가격 밀도 기준으로 클러스터링한다 (1D DBSCAN 유사 로직,
   ``eps = 평균가 × 0.008`` = 0.8% 이내면 같은 레벨).
3. 클러스터별 ``(터치 횟수, 최근성)`` 점수로 상위 N개를 선택한다.
4. 현재가 위쪽 최상위 레벨 = 저항선, 현재가 아래쪽 최상위 레벨 = 지지선.

numpy 만 사용한다 — scipy/sklearn 은 설치 부담이 커서 의도적으로 제외.

``mcp-opendart-server`` 및 ``pykrx`` 의 데이터 가공 패턴을 참고했다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from app.domain.entity.stock import Candle

logger = logging.getLogger(__name__)


@dataclass
class DetectedLevel:
    """순수 알고리즘이 뽑아낸 후보 레벨 — Claude 해설 적용 전."""

    price: float
    kind: str              # "support" | "resistance"
    touch_count: int       # 이 가격대 근처에서 스윙이 발생한 횟수
    last_touch_idx: int    # 마지막으로 터치된 캔들 인덱스 (0 = 오래됨, len-1 = 최근)
    strength: int          # 0~100 정규화 점수 (터치 횟수 × 최근성)


class LevelDetector:
    """스윙 포인트 + 가격 클러스터링 기반 S/R 레벨 탐지."""

    def __init__(
        self,
        swing_window: int = 3,
        cluster_eps_pct: float = 0.012,
        min_touches: int = 2,
        max_distance_pct: float = 0.20,
    ) -> None:
        self.swing_window = swing_window
        self.cluster_eps_pct = cluster_eps_pct
        self.min_touches = min_touches
        self.max_distance_pct = max_distance_pct

    def detect(
        self,
        candles: list[Candle],
        current_price: float,
        max_levels: int = 4,
    ) -> list[DetectedLevel]:
        if len(candles) < self.swing_window * 2 + 1:
            return []

        highs = np.array([c.high for c in candles], dtype=float)
        lows = np.array([c.low for c in candles], dtype=float)
        closes = np.array([c.close for c in candles], dtype=float)

        swing_high_idx = _find_swing_indices(highs, self.swing_window, mode="high")
        swing_low_idx = _find_swing_indices(lows, self.swing_window, mode="low")

        avg_price = float(closes.mean())
        eps = avg_price * self.cluster_eps_pct

        # 스윙 하이 → 저항 후보, 스윙 로우 → 지지 후보
        resistance_clusters = _cluster_prices(
            highs[swing_high_idx], swing_high_idx.tolist(), eps
        )
        support_clusters = _cluster_prices(
            lows[swing_low_idx], swing_low_idx.tolist(), eps
        )

        total_candles = len(candles)
        resistance_levels = _clusters_to_levels(
            resistance_clusters,
            kind="resistance",
            total_candles=total_candles,
            min_touches=self.min_touches,
        )
        support_levels = _clusters_to_levels(
            support_clusters,
            kind="support",
            total_candles=total_candles,
            min_touches=self.min_touches,
        )

        # 현재가 기준 분리: 저항은 현재가 위쪽, 지지는 현재가 아래쪽만 남긴다.
        # (돌파된 저항이 지지로 전환된 케이스는 무시 — 복잡도 vs 정확도 트레이드오프)
        # 또한 현재가로부터 ``max_distance_pct`` 이상 떨어진 레벨은 실익이
        # 적으므로 제외 (예: -50% 지지선은 참고용으로도 의미가 옅다).
        max_delta = current_price * self.max_distance_pct
        lower_bound = current_price - max_delta
        upper_bound = current_price + max_delta

        resistance_above = [
            lv
            for lv in resistance_levels
            if current_price < lv.price <= upper_bound
        ]
        support_below = [
            lv
            for lv in support_levels
            if lower_bound <= lv.price < current_price
        ]

        resistance_above.sort(key=lambda lv: lv.strength, reverse=True)
        support_below.sort(key=lambda lv: lv.strength, reverse=True)

        # 각 유형당 max_levels/2 개씩 선택
        half = max(1, max_levels // 2)
        picked = support_below[:half] + resistance_above[:half]

        # 출력은 가격 오름차순
        picked.sort(key=lambda lv: lv.price)
        return picked


# ── helpers ──────────────────────────────────────────────────────────────


def _find_swing_indices(
    series: np.ndarray, window: int, mode: str
) -> np.ndarray:
    """좌우 ``window`` 봉 범위에서 최대(또는 최소)인 인덱스를 반환.

    ``scipy.signal.find_peaks`` 의 단순 버전. 경계 근처는 비교 대상이
    충분치 않으므로 건너뛴다.
    """

    n = len(series)
    if n < window * 2 + 1:
        return np.array([], dtype=int)

    result: list[int] = []
    for i in range(window, n - window):
        left = series[i - window : i]
        right = series[i + 1 : i + 1 + window]
        if mode == "high":
            if series[i] >= left.max() and series[i] >= right.max():
                result.append(i)
        else:
            if series[i] <= left.min() and series[i] <= right.min():
                result.append(i)
    return np.array(result, dtype=int)


@dataclass
class _Cluster:
    prices: list[float]
    indices: list[int]

    @property
    def centroid(self) -> float:
        return float(np.mean(self.prices))

    @property
    def touch_count(self) -> int:
        return len(self.prices)

    @property
    def last_index(self) -> int:
        return max(self.indices) if self.indices else 0


def _cluster_prices(
    prices: np.ndarray, indices: list[int], eps: float
) -> list[_Cluster]:
    """가격 정렬 후 ``eps`` 이내 연속 그룹으로 묶는 1D DBSCAN 유사 로직.

    ``eps`` 보다 가격 차이가 작으면 같은 클러스터에 병합한다.
    """

    if len(prices) == 0:
        return []

    # (price, index) 쌍으로 만들어 price 기준 정렬
    pairs = sorted(zip(prices.tolist(), indices), key=lambda p: p[0])

    clusters: list[_Cluster] = []
    current = _Cluster(prices=[pairs[0][0]], indices=[pairs[0][1]])

    for price, idx in pairs[1:]:
        if price - current.prices[-1] <= eps:
            current.prices.append(price)
            current.indices.append(idx)
        else:
            clusters.append(current)
            current = _Cluster(prices=[price], indices=[idx])
    clusters.append(current)
    return clusters


def _clusters_to_levels(
    clusters: list[_Cluster],
    kind: str,
    total_candles: int,
    min_touches: int,
) -> list[DetectedLevel]:
    """클러스터를 ``DetectedLevel`` 로 변환하며 strength 점수를 계산."""

    if not clusters:
        return []

    levels: list[DetectedLevel] = []
    max_touch = max(c.touch_count for c in clusters)

    for cluster in clusters:
        if cluster.touch_count < min_touches:
            continue
        # 터치 수 비율 (0~60점)
        touch_score = (cluster.touch_count / max_touch) * 60
        # 최근성 (0~40점) — 마지막 터치가 최근일수록 높음
        recency = cluster.last_index / max(1, total_candles - 1)
        recency_score = recency * 40
        strength = int(touch_score + recency_score)

        levels.append(
            DetectedLevel(
                price=round(cluster.centroid, 2),
                kind=kind,
                touch_count=cluster.touch_count,
                last_touch_idx=cluster.last_index,
                strength=max(0, min(100, strength)),
            )
        )
    return levels


_detector_singleton: LevelDetector | None = None


def get_level_detector() -> LevelDetector:
    global _detector_singleton
    if _detector_singleton is None:
        _detector_singleton = LevelDetector()
    return _detector_singleton
