from __future__ import annotations

from pydantic import BaseModel

from app.domain.entity.indicator import Indicators, Signal


class IndicatorsDTO(BaseModel):
    rsi14: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None
    sma5: float | None = None
    sma20: float | None = None
    sma60: float | None = None
    sma120: float | None = None
    stoch_k: float | None = None
    stoch_d: float | None = None
    williams_r: float | None = None
    cci: float | None = None
    adx: float | None = None
    # docs/01 추가 지표
    vwap: float | None = None
    volume_ratio: float | None = None
    close_price: float | None = None

    @classmethod
    def from_entity(cls, entity: Indicators) -> "IndicatorsDTO":
        return cls(**entity.__dict__)


class SignalDTO(BaseModel):
    symbol: str
    type: str               # STRONG_BUY | BUY | HOLD | SELL
    confidence: int
    momentum: int
    step1_technical: bool
    step2_sentiment: bool
    cond_rsi_bb: bool = False
    cond_trend_pullback: bool = False
    cond_vwap_volume: bool = False
    cond_supply: bool = False
    score_tech: int = 0
    score_supply: int = 0
    score_news: int = 0
    score_psych: int = 0
    target_price: float | None = None
    reasons: list[str]
    ai_confirmation: str | None = None
    ai_verdict: str | None = None

    @classmethod
    def from_entity(cls, entity: Signal) -> "SignalDTO":
        return cls(
            symbol=entity.symbol,
            type=entity.type,
            confidence=entity.confidence,
            momentum=entity.momentum,
            step1_technical=entity.step1_technical,
            step2_sentiment=entity.step2_sentiment,
            cond_rsi_bb=entity.cond_rsi_bb,
            cond_trend_pullback=entity.cond_trend_pullback,
            cond_vwap_volume=entity.cond_vwap_volume,
            cond_supply=entity.cond_supply,
            score_tech=entity.score_tech,
            score_supply=entity.score_supply,
            score_news=entity.score_news,
            score_psych=entity.score_psych,
            target_price=entity.target_price,
            reasons=entity.reasons,
            ai_confirmation=entity.ai_confirmation,
            ai_verdict=entity.ai_verdict,
        )


class MomentumDTO(BaseModel):
    symbol: str
    score: int


class BriefingDTO(BaseModel):
    symbol: str
    stock_name: str
    message: str
    signal_type: str
    momentum: int
    target_price: float | None = None
