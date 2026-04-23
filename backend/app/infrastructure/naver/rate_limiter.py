"""도메인별 HTTP Rate Limiter — docs/10 §5 IP 차단 방지.

각 외부 서비스(네이버/DART/KRX)마다 독립 락 + 마지막 요청 시각을 유지한다.
한 도메인의 호출이 다른 도메인을 블록하지 않는다.

동기 함수 — ``asyncio.to_thread`` 내부에서 호출되므로 이벤트 루프 미차단.
"""

from __future__ import annotations

import threading
import time

# 도메인별 최소 요청 간격 (초)
DEFAULT_INTERVAL = 0.5
_INTERVALS: dict[str, float] = {
    "naver": 0.5,      # 네이버 — 보수적
    "dart": 0.3,       # DART 공식 API — 조금 더 공격적 가능
    "krx": 0.5,        # KRX
    "fdr": 0.3,        # FinanceDataReader (Yahoo 등 섞임)
}


class _DomainState:
    __slots__ = ("lock", "last_at")

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.last_at = 0.0


_states: dict[str, _DomainState] = {}
_states_lock = threading.Lock()


def _state(domain: str) -> _DomainState:
    with _states_lock:
        st = _states.get(domain)
        if st is None:
            st = _DomainState()
            _states[domain] = st
        return st


def throttle(domain: str = "naver") -> None:
    """해당 도메인의 마지막 호출 이후 MIN_INTERVAL 이 지나지 않았으면 대기.

    다른 도메인 호출은 블록하지 않는다.
    """

    interval = _INTERVALS.get(domain, DEFAULT_INTERVAL)
    st = _state(domain)
    with st.lock:
        now = time.monotonic()
        elapsed = now - st.last_at
        if elapsed < interval:
            time.sleep(interval - elapsed)
        st.last_at = time.monotonic()
