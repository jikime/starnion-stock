from dataclasses import dataclass, field


@dataclass
class Indicators:
    rsi14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None
    sma5: float | None = None
    sma20: float | None = None
    sma50: float | None = None           # docs/03 리버모어 Price>MA50>MA200
    sma60: float | None = None
    sma120: float | None = None
    sma200: float | None = None          # 리버모어형 장기 추세 기준선
    stoch_k: float | None = None
    stoch_d: float | None = None
    williams_r: float | None = None
    cci: float | None = None
    adx: float | None = None
    # docs/01 추가 지표
    vwap: float | None = None          # 거래량 가중 평균 가격
    volume_ratio: float | None = None  # 최근 거래량 / 20일 평균 (스파이크 배수)
    close_price: float | None = None   # BB 하단 돌파/VWAP 비교용 마지막 종가
    # docs/02 리버모어 — 전일 기준 피벗 포인트 + R1/S1 (전환점 돌파 판단)
    pivot: float | None = None         # (전일 H + L + C) / 3
    pivot_r1: float | None = None      # 2 × pivot - 전일 L
    pivot_s1: float | None = None      # 2 × pivot - 전일 H


@dataclass
class Signal:
    symbol: str
    type: str            # "STRONG_BUY" | "BUY" | "HOLD" | "SELL"
    confidence: int      # 0~100
    momentum: int        # 0~100
    step1_technical: bool = False    # 기술 조합 (3 서브 조건 중 ≥1 충족)
    step2_sentiment: bool = False    # 뉴스 긍정 >= 0.7
    # docs/01 3개 매수 타점 breakdown
    cond_rsi_bb: bool = False        # ① RSI<30 AND Price<BB_Lower
    cond_trend_pullback: bool = False # ② MA 정배열 + MA20 근접 (눌림목)
    cond_vwap_volume: bool = False    # ③ Price>VWAP AND Volume>Avg*2
    cond_supply: bool = False         # 수급 (외인/기관 최근 5일 순매수>0)
    # docs/01 복합 점수 (기술 40 + 수급 30 + 뉴스 20 + 심리 10)
    score_tech: int = 0
    score_supply: int = 0
    score_news: int = 0
    score_psych: int = 0
    target_price: float | None = None
    reasons: list[str] = field(default_factory=list)
    # docs/01 4번 AI 최종 컨펌 — STRONG_BUY 일 때만 Claude 가 뉴스 악재 체크
    ai_confirmation: str | None = None    # 한 문장 요약 (없으면 None)
    ai_verdict: str | None = None         # "CONFIRM" | "CAUTION" | "REJECT" | None
