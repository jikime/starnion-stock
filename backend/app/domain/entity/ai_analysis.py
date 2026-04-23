"""Claude LLM 심층 분석 결과 엔티티.

``SignalUseCase`` 의 룰 기반 판정과 달리, 이 엔티티는 사용자가 수동으로
버튼을 클릭했을 때 Claude 가 기술적 지표 + 뉴스 + 공시 를 종합하여
한국어 투자 의견을 제시한 결과이다. 결정적 판정이 아니므로 히스토리로
보존하여 나중에 AI 정확도 추적에 활용한다.
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class AIAnalysis:
    id: str
    symbol: str
    stock_name: str
    decision: str              # "BUY" | "SELL" | "HOLD"
    confidence: int            # 0 ~ 100
    summary: str               # 한 문장 요약
    reasoning: str             # 종합 투자 의견 (2~3 문장)
    positives: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)
    target_price: float | None = None
    rsi: float | None = None
    macd_state: str | None = None   # "golden" | "dead" | "neutral"
    news_count: int = 0
    price_at_analysis: float | None = None  # 분석 시점 현재가 (정확도 추적용)
    created_at: datetime | None = None
