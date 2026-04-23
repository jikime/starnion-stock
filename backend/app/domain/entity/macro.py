"""거시경제 스냅샷 엔티티.

대시보드의 매크로 위젯에 표시되는 외환/금리/공포지수 등 종합 데이터.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MacroIndicator:
    """단일 거시 지표."""

    code: str              # "USD/KRW" | "KS11" | "VIX" | "FNG" | "CL=F"
    label: str             # 한국어 표시명 ("원/달러", "코스피", "VIX", "공포·탐욕", "WTI 유가")
    value: float
    change: float          # 전일 대비 절대값
    change_pct: float      # 전일 대비 % (소수가 아닌 백분율 그대로, e.g. -1.23)


@dataclass
class MacroSnapshot:
    """대시보드용 매크로 스냅샷."""

    indicators: list[MacroIndicator]
    risk_level: str        # "low" | "mid" | "high" — 종합 리스크 평가
    risk_summary: str      # 한 문장 요약
    fetched_at: datetime
