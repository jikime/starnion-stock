"""거장 3인(버핏/오닐/리버모어) 스코어 엔티티.

``docs/02``, ``docs/03``, ``docs/04`` 의 한국형 가중치를 반영한 멀티팩터 스코어.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class MasterScore:
    """단일 거장의 평가 결과."""

    name: str                          # "buffett" | "oneill" | "livermore"
    label: str                         # "워런 버핏" | "윌리엄 오닐" | "제시 리버모어"
    score: int                         # 0~100
    signal: str                        # "BUY" | "HOLD" | "SELL"
    reasons: list[str] = field(default_factory=list)


@dataclass
class FundamentalSnapshot:
    """기업 펀더멘탈 종합 — 네이버 (시가/밸류) + DART (재무비율).

    docs/02 거장별 필요 지표:
      버핏: ROE, 부채비율, 영업이익률 (또는 순이익증가율)
      오닐: 분기 이익 성장률 (net_income_growth)
    """

    # 네이버 종목 메인 (시가 기반 밸류 지표)
    per: float | None = None
    eps: float | None = None
    pbr: float | None = None
    dividend_yield: float | None = None     # 배당률 (%)
    # DART fnlttSinglIndx (가장 최근 사업보고서 기준)
    roe: float | None = None                # 자기자본이익률 (%)
    debt_ratio: float | None = None         # 부채비율 (%)
    net_profit_margin: float | None = None  # 순이익률 (%)
    revenue_growth: float | None = None     # 매출액증가율 YoY (%)
    net_income_growth: float | None = None  # 순이익증가율 YoY (%)
    op_income_growth: float | None = None   # 영업이익증가율 YoY (%)


@dataclass
class ForeignFlowPoint:
    """docs/04 외인 수급 일별 포인트 — 오닐 카드 시각화용."""

    date: str      # ISO "2026-04-15"
    net: int       # foreign_net (주식 수, + 매수 / - 매도)


@dataclass
class MasterScores:
    """3인 스코어 통합 결과 + Star Score."""

    symbol: str
    stock_name: str
    buffett: MasterScore
    oneill: MasterScore
    livermore: MasterScore
    star_score: int                    # 가중평균 (0.3·B + 0.4·O + 0.3·L)
    fundamental: FundamentalSnapshot
    computed_at: datetime
    # docs/03 § "3인 매칭 해설" — 어느 거장 관점에서 강/약한지 한 문장 요약
    commentary: str = ""
    # docs/04 § "Foreign Net Buying flow" — 최근 5거래일 외인 순매수 (오닐 카드)
    foreign_flow: list[ForeignFlowPoint] = field(default_factory=list)
    # docs/05 § 기관 순매수 flow — 외인과 동일 구조
    institution_flow: list[ForeignFlowPoint] = field(default_factory=list)
    # docs/04 § "Volume Spike" — 당일 거래량 / 20일 평균 (리버모어 카드)
    volume_ratio: float | None = None
    # docs/04 § "개인 거래대금" — 개인 순매수 = -(외인+기관) (리버모어 한국형)
    retail_net_5d: int | None = None   # 최근 5일 개인 순매수 추정 (주)
    # docs/09 — 매크로 컨펌 노트 (환율/VIX/리스크 반영 내역)
    macro_notes: list[str] = field(default_factory=list)
