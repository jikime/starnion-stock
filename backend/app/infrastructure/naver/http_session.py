"""공유 requests Session — TCP keep-alive + connection pooling.

기존 ``requests.get(...)`` 매번 호출은 TLS handshake + TCP 연결을
매 호출마다 재수행한다. Session 공유로 10~30ms × N 호출 절약.

B2 목적: httpx 네이티브 async 전환의 80% 효과를 최소 변경으로 달성.
"""

from __future__ import annotations

import threading
import requests
from requests.adapters import HTTPAdapter

_session_lock = threading.Lock()
_session: requests.Session | None = None


def get_session() -> requests.Session:
    """프로세스 전역 공유 Session. 최초 호출 시 lazy 초기화."""

    global _session
    if _session is not None:
        return _session
    with _session_lock:
        if _session is not None:
            return _session
        s = requests.Session()
        # HTTP / HTTPS 각각 풀 크기 확장
        adapter = HTTPAdapter(
            pool_connections=20,   # 호스트당 커넥션 풀 크기
            pool_maxsize=40,       # 최대 재사용 연결 수
            max_retries=0,
        )
        s.mount("http://", adapter)
        s.mount("https://", adapter)
        _session = s
        return _session
