"""종목별 투자자별 매매동향 엔티티 (docs/01 복합 점수 '수급' 30%)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass
class InvestorFlowDay:
    """특정 거래일의 외인/기관 순매수 수량."""

    trade_date: date
    foreign_net: int       # 외국인 순매수 (+) 매수 / (-) 매도 수량
    institution_net: int   # 기관 순매수 수량
    close_price: int
    volume: int
    foreign_holding_pct: float | None = None  # 외인 보유율 %


@dataclass
class InvestorFlow:
    """최근 N일치 수급 + 집계 요약."""

    symbol: str
    days: list[InvestorFlowDay] = field(default_factory=list)

    @property
    def foreign_net_5d(self) -> int:
        return sum(d.foreign_net for d in self.days[:5])

    @property
    def institution_net_5d(self) -> int:
        return sum(d.institution_net for d in self.days[:5])

    @property
    def foreign_net_streak(self) -> int:
        """외인 연속 순매수 일수 (최근부터 연속 양수)."""

        n = 0
        for d in self.days:
            if d.foreign_net > 0:
                n += 1
            else:
                break
        return n
