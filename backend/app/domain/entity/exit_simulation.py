"""매도 시뮬레이터 엔티티 — ``docs/06`` 거장별 매도 타점 + ``docs/07`` Exit Urgency."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ExitSignal:
    """4단계 매도 감시 항목 중 하나."""

    name: str               # "stoploss" | "trend" | "overheat" | "target"
    label: str              # "손절" | "추세 이탈" | "과열" | "목표 도달"
    triggered: bool
    detail: str = ""        # 한 줄 설명


@dataclass
class MasterExitOpinion:
    """거장별 매도 결정."""

    name: str               # "buffett" | "oneill" | "livermore"
    label: str
    decision: str           # "HOLD" | "SELL"
    reason: str = ""


@dataclass
class ExitSimulation:
    symbol: str
    entry_price: float
    current_price: float
    pnl: float              # 평가손익 (절대값, 원)
    pnl_pct: float          # 등락률 (%)
    urgency_score: int      # 0~100 (Exit Urgency Score)
    recommendation: str     # "HOLD" | "WATCH" | "SELL"
    signals: list[ExitSignal] = field(default_factory=list)
    master_opinions: list[MasterExitOpinion] = field(default_factory=list)
