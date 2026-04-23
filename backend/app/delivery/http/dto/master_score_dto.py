from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.master_score import (
    ForeignFlowPoint,
    FundamentalSnapshot,
    MasterScore,
    MasterScores,
)


class MasterScoreDTO(BaseModel):
    name: str
    label: str
    score: int
    signal: str
    reasons: list[str]

    @classmethod
    def from_entity(cls, e: MasterScore) -> "MasterScoreDTO":
        return cls(
            name=e.name,
            label=e.label,
            score=e.score,
            signal=e.signal,
            reasons=e.reasons,
        )


class FundamentalDTO(BaseModel):
    per: float | None = None
    eps: float | None = None
    pbr: float | None = None
    dividend_yield: float | None = None
    # docs/02 DART 재무비율
    roe: float | None = None
    debt_ratio: float | None = None
    net_profit_margin: float | None = None
    revenue_growth: float | None = None
    net_income_growth: float | None = None
    op_income_growth: float | None = None

    @classmethod
    def from_entity(cls, e: FundamentalSnapshot) -> "FundamentalDTO":
        return cls(
            per=e.per,
            eps=e.eps,
            pbr=e.pbr,
            dividend_yield=e.dividend_yield,
            roe=e.roe,
            debt_ratio=e.debt_ratio,
            net_profit_margin=e.net_profit_margin,
            revenue_growth=e.revenue_growth,
            net_income_growth=e.net_income_growth,
            op_income_growth=e.op_income_growth,
        )


class ForeignFlowPointDTO(BaseModel):
    date: str           # ISO YYYY-MM-DD
    net: int            # 외인 순매수 주식 수

    @classmethod
    def from_entity(cls, e: ForeignFlowPoint) -> "ForeignFlowPointDTO":
        return cls(date=e.date, net=e.net)


class MasterScoresDTO(BaseModel):
    symbol: str
    stock_name: str
    buffett: MasterScoreDTO
    oneill: MasterScoreDTO
    livermore: MasterScoreDTO
    star_score: int
    fundamental: FundamentalDTO
    computed_at: datetime
    commentary: str = ""                        # docs/03 3인 매칭 해설
    foreign_flow: list[ForeignFlowPointDTO] = []       # docs/04 외인 5일 flow
    institution_flow: list[ForeignFlowPointDTO] = []   # docs/05 기관 5일 flow
    volume_ratio: float | None = None            # docs/04 Volume Spike
    retail_net_5d: int | None = None              # docs/04 개인 순매수 5일
    macro_notes: list[str] = []                   # docs/09 매크로 컨펌 노트

    @classmethod
    def from_entity(cls, e: MasterScores) -> "MasterScoresDTO":
        return cls(
            symbol=e.symbol,
            stock_name=e.stock_name,
            buffett=MasterScoreDTO.from_entity(e.buffett),
            oneill=MasterScoreDTO.from_entity(e.oneill),
            livermore=MasterScoreDTO.from_entity(e.livermore),
            star_score=e.star_score,
            fundamental=FundamentalDTO.from_entity(e.fundamental),
            computed_at=e.computed_at,
            commentary=e.commentary,
            foreign_flow=[
                ForeignFlowPointDTO.from_entity(p) for p in e.foreign_flow
            ],
            institution_flow=[
                ForeignFlowPointDTO.from_entity(p) for p in e.institution_flow
            ],
            volume_ratio=e.volume_ratio,
            retail_net_5d=e.retail_net_5d,
            macro_notes=e.macro_notes,
        )
