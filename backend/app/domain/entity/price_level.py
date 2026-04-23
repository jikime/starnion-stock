"""AI 지지/저항 레벨 엔티티.

``LevelDetector`` 가 계산한 후보 레벨에 Claude 의 해설을 덧붙인 최종 산출물.
``LevelUseCase`` 가 이 엔티티로 조립하여 SQLite 에 캐시한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class PriceLevel:
    price: float
    kind: str              # "support" | "resistance"
    touch_count: int       # 이 가격대에서 반등/반락한 횟수
    strength: int          # 0~100 정규화 점수
    explanation: str = ""  # Claude 가 생성한 한 문장 해설


@dataclass
class PriceLevelsSnapshot:
    """특정 종목/타임프레임에 대한 S/R 레벨 집합 + 캐시 메타데이터."""

    symbol: str
    current_price: float
    levels: list[PriceLevel]
    computed_at: datetime
