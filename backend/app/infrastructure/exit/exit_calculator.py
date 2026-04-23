"""매도 시뮬레이터 코어 로직.

``docs/06`` 거장별 매도 타점:
- 오닐: -7~8% 손절, +20~25% 익절, 매물대 돌파 실패
- 리버모어: MA20 이탈, 거래량 동반 하락
- 버핏: ROE 급락, 경제적 해자 파괴 (1차 MVP에선 PER 급등으로 근사)

``docs/07`` 4단계 감시:
1. 손절 (-7%)
2. 추세 이탈 (MA20 이탈, 정배열 깨짐)
3. 과열 (RSI > 75)
4. 목표 도달 (+20~25%)

Exit Urgency Score = 발현된 시그널 가중합 (0~100).
"""

from __future__ import annotations

from app.domain.entity.exit_simulation import (
    ExitSignal,
    ExitSimulation,
    MasterExitOpinion,
)
from app.domain.entity.indicator import Indicators
from app.domain.entity.master_score import FundamentalSnapshot


# 4단계 감시 임계값 (한국형: 손절 -7%, 익절 +20%)
STOPLOSS_PCT = -7.0
TARGET_PCT = 20.0
RSI_OVERHEAT = 75.0


# 가중치 (총합 100)
WEIGHTS = {
    "stoploss": 40,
    "trend": 25,
    "overheat": 15,
    "target": 20,
}


def calculate_exit(
    entry_price: float,
    current_price: float,
    indicators: Indicators,
    fundamental: FundamentalSnapshot | None = None,
    entry_date: str | None = None,
    stoploss_pct: float | None = None,
    target_pct: float | None = None,
) -> ExitSimulation:
    """매도 시뮬레이션 결과 산출."""

    pnl = current_price - entry_price
    pnl_pct = (pnl / entry_price * 100) if entry_price else 0.0

    # docs/07 §2: 커스텀 손절/익절 (미지정 시 기본값)
    sl_pct = stoploss_pct if stoploss_pct is not None else STOPLOSS_PCT
    tgt_pct = target_pct if target_pct is not None else TARGET_PCT
    # 손절은 음수로 통일
    if sl_pct > 0:
        sl_pct = -sl_pct

    # 4단계 시그널
    signals: list[ExitSignal] = []
    urgency = 0

    # 1. 손절 — docs/07 §1 3단계 (커스텀 가능)
    # 3단계 구간: 즉시매도(sl_pct) / 경고(sl_pct + 2%p) / 주의(sl_pct + 4%p)
    warn_pct = sl_pct + 2.0   # 예: -7 → -5
    caution_pct = sl_pct + 4.0  # 예: -7 → -3

    sl_trig = pnl_pct <= sl_pct
    if sl_trig:
        sl_detail = f"손실 {pnl_pct:.1f}% — 즉시매도 구간({sl_pct:.0f}%) 이탈"
        urgency += WEIGHTS["stoploss"]
    elif pnl_pct <= warn_pct:
        sl_detail = f"손실 {pnl_pct:.1f}% — [경고] 손절선({sl_pct:.0f}%) 근접"
        urgency += int(WEIGHTS["stoploss"] * 0.6)
        sl_trig = True
    elif pnl_pct <= caution_pct:
        sl_detail = f"손실 {pnl_pct:.1f}% — [주의] 손절 대기 구간"
        urgency += int(WEIGHTS["stoploss"] * 0.3)
        sl_trig = True
    else:
        sl_detail = f"현재 손익 {pnl_pct:+.1f}% (손절선 {sl_pct:.0f}%)"

    signals.append(
        ExitSignal(
            name="stoploss",
            label="손절",
            triggered=sl_trig,
            detail=sl_detail,
        )
    )

    # 2. 추세 이탈
    sma5 = indicators.sma5 or 0
    sma20 = indicators.sma20 or 0
    sma60 = indicators.sma60 or 0
    trend_break = (
        current_price < sma20
        if sma20 > 0
        else False
    )
    aligned = sma5 > sma20 > sma60 if sma60 > 0 else False
    if trend_break and not aligned:
        signals.append(
            ExitSignal(
                name="trend",
                label="추세 이탈",
                triggered=True,
                detail=f"현재가 {current_price:,.0f} < MA20 {sma20:,.0f}, 정배열 깨짐",
            )
        )
        urgency += WEIGHTS["trend"]
    else:
        signals.append(
            ExitSignal(
                name="trend",
                label="추세 이탈",
                triggered=False,
                detail=f"MA20 {sma20:,.0f} 위 유지",
            )
        )

    # 3. 과열 — docs/06 §4: RSI > 75 AND/OR 볼린저 상단 이탈 후 복귀
    rsi = indicators.rsi14
    vr = indicators.volume_ratio
    bb_upper = indicators.bb_upper
    close = indicators.close_price

    rsi_hot = rsi is not None and rsi > RSI_OVERHEAT
    # docs/06 §4: RSI > 75 + 거래량 폭발 동시 충족 → 강한 과열
    rsi_vol_hot = rsi_hot and vr is not None and vr > 2.0
    # docs/06 §1④: 볼린저 밴드 상단 이탈 후 복귀 (close < bb_upper 인데 근접)
    bb_reentry = (
        bb_upper is not None
        and close is not None
        and close < bb_upper
        and (bb_upper - close) / bb_upper < 0.005  # 0.5% 이내 복귀
    )

    # docs/07 §1③: Momentum Exhaustion — RSI>75 + 거래량 급감 (동력 상실)
    momentum_exhaustion = (
        rsi_hot and vr is not None and vr < 0.7
    )

    overheat = rsi_hot or bb_reentry or momentum_exhaustion
    overheat_details: list[str] = []
    if momentum_exhaustion:
        overheat_details.append(
            f"RSI {rsi:.1f} 과매수 + 거래량 {vr:.1f}× 급감 — 상승 동력 상실"
        )
    elif rsi_vol_hot:
        overheat_details.append(
            f"RSI {rsi:.1f} 과매수 + 거래량 {vr:.1f}× 동반 (강한 과열)"
        )
    elif rsi_hot:
        overheat_details.append(f"RSI {rsi:.1f} 과매수 (>75)")
    if bb_reentry:
        overheat_details.append("볼린저 상단 이탈 후 복귀 — 단기 조정 신호")

    signals.append(
        ExitSignal(
            name="overheat",
            label="과열",
            triggered=bool(overheat),
            detail=(
                " / ".join(overheat_details)
                if overheat_details
                else (f"RSI {rsi:.1f} 정상 범위" if rsi is not None else "RSI n/a")
            ),
        )
    )
    if overheat:
        urgency += WEIGHTS["overheat"]

    # 4. 목표 도달 — docs/07 §1④: 도달률 % 표현 (커스텀 가능)
    target_hit = pnl_pct >= tgt_pct
    if pnl_pct > 0:
        reach_pct = min(100, pnl_pct / tgt_pct * 100)
    else:
        reach_pct = 0
    signals.append(
        ExitSignal(
            name="target",
            label="목표 도달",
            triggered=target_hit,
            detail=(
                f"수익 {pnl_pct:.1f}% — 익절 권장 구간({tgt_pct:.0f}%) 진입"
                if target_hit
                else f"목표의 {reach_pct:.0f}% 도달 (남은 {tgt_pct - pnl_pct:.1f}%p)"
            ),
        )
    )
    if target_hit:
        urgency += WEIGHTS["target"]

    urgency = max(0, min(100, urgency))
    if urgency >= 70:
        recommendation = "SELL"
    elif urgency >= 40:
        recommendation = "WATCH"
    else:
        recommendation = "HOLD"

    # 거장별 매도 결정 (docs/06)
    opinions = _master_opinions(
        entry_price=entry_price,
        current_price=current_price,
        pnl_pct=pnl_pct,
        indicators=indicators,
        fundamental=fundamental,
        entry_date=entry_date,
    )

    return ExitSimulation(
        symbol="",
        entry_price=entry_price,
        current_price=current_price,
        pnl=pnl,
        pnl_pct=pnl_pct,
        urgency_score=urgency,
        recommendation=recommendation,
        signals=signals,
        master_opinions=opinions,
    )


def _master_opinions(
    entry_price: float,
    current_price: float,
    pnl_pct: float,
    indicators: Indicators,
    fundamental: FundamentalSnapshot | None,
    entry_date: str | None = None,
) -> list[MasterExitOpinion]:
    """거장별 매도 결정 — 각자 다른 기준."""

    from datetime import datetime

    opinions: list[MasterExitOpinion] = []

    # 매수일로부터 경과 주수 계산
    weeks_held: float | None = None
    if entry_date:
        try:
            ed = datetime.fromisoformat(entry_date).date()
            weeks_held = (datetime.now().date() - ed).days / 7.0
        except (ValueError, TypeError):
            pass

    # 오닐: docs/04 "8% 손절" + docs/06 §1① "3주 내 +20% 급등 → 8주 보유"
    # 예외: 3주 이내에 20%가 급등하면 '진짜 대장주'로 보고 8주간 더 보유
    rapid_riser = (
        weeks_held is not None
        and weeks_held <= 3.0
        and pnl_pct >= 20.0
    )
    within_8_weeks = weeks_held is not None and weeks_held < 8.0

    if rapid_riser and within_8_weeks:
        # 대장주 예외: 8주까지 보유
        remaining = 8.0 - (weeks_held or 0)
        opinions.append(
            MasterExitOpinion(
                name="oneill",
                label="윌리엄 오닐",
                decision="HOLD",
                reason=(
                    f"3주 내 +{pnl_pct:.0f}% 급등 — 대장주! "
                    f"8주 보유 룰 ({remaining:.0f}주 남음)"
                ),
            )
        )
    elif pnl_pct <= -8.0:
        opinions.append(
            MasterExitOpinion(
                name="oneill",
                label="윌리엄 오닐",
                decision="SELL",
                reason=f"손실 {pnl_pct:.1f}% — 8% 손절 룰 발동",
            )
        )
    elif pnl_pct >= 25.0:
        opinions.append(
            MasterExitOpinion(
                name="oneill",
                label="윌리엄 오닐",
                decision="SELL",
                reason=f"수익 {pnl_pct:.1f}% — 20~25% 익절 권고",
            )
        )
    else:
        opinions.append(
            MasterExitOpinion(
                name="oneill",
                label="윌리엄 오닐",
                decision="HOLD",
                reason=f"손익 {pnl_pct:+.1f}% — 손절(-8%)·익절(+25%) 미발동",
            )
        )

    # 리버모어: docs/04 "5% 칼손절" + docs/06 "추세 이탈 & 위험 신호"
    sma20 = indicators.sma20
    vr = indicators.volume_ratio
    close = indicators.close_price
    live_sell_reasons: list[str] = []

    # (a) docs/04 한국형 5% 칼손절
    if pnl_pct <= -5.0:
        live_sell_reasons.append(
            f"손실 {pnl_pct:.1f}% — 5% 칼손절 (한국형)"
        )

    # (b) MA20 이탈
    if sma20 and current_price < sma20:
        live_sell_reasons.append(
            f"현재가 {current_price:,.0f} < MA20 {sma20:,.0f} — 추세 종료"
        )

    # (c) docs/06 §1②: 위험 신호 — 거래량 폭발 + 주가 미상승 (분산매도세)
    # "거래량이 터졌는데 주가는 못 오르거나 떨어질 때"
    if vr is not None and vr > 2.0 and pnl_pct <= 1.0:
        live_sell_reasons.append(
            f"거래량 {vr:.1f}× 폭발인데 주가 미상승 — 분산(매도세) 의심"
        )

    if live_sell_reasons:
        opinions.append(
            MasterExitOpinion(
                name="livermore",
                label="제시 리버모어",
                decision="SELL",
                reason=" / ".join(live_sell_reasons),
            )
        )
    else:
        opinions.append(
            MasterExitOpinion(
                name="livermore",
                label="제시 리버모어",
                decision="HOLD",
                reason=(
                    f"MA20 {sma20:,.0f} 위 유지, 손절선(-5%) 미도달"
                    if sma20
                    else "MA20 데이터 부족"
                ),
            )
        )

    # 버핏: docs/06 §1③ 펀더멘탈 훼손 — PER 급등 + ROE 급락 + 부채비율 급등
    per = fundamental.per if fundamental else None
    roe = fundamental.roe if fundamental else None
    debt = fundamental.debt_ratio if fundamental else None

    buffett_sell_reasons: list[str] = []
    if per is not None and per > 50:
        buffett_sell_reasons.append(f"PER {per:.1f} — 안전마진 소실")
    if roe is not None and roe < 5:
        buffett_sell_reasons.append(f"ROE {roe:.1f}% 급락 — 수익성 훼손")
    if debt is not None and debt > 200:
        buffett_sell_reasons.append(f"부채비율 {debt:.0f}% — 재무 위험")

    if buffett_sell_reasons:
        opinions.append(
            MasterExitOpinion(
                name="buffett",
                label="워런 버핏",
                decision="SELL",
                reason=" / ".join(buffett_sell_reasons),
            )
        )
    else:
        hold_parts: list[str] = []
        if per is not None:
            hold_parts.append(f"PER {per:.1f}")
        if roe is not None:
            hold_parts.append(f"ROE {roe:.1f}%")
        if debt is not None:
            hold_parts.append(f"부채 {debt:.0f}%")
        opinions.append(
            MasterExitOpinion(
                name="buffett",
                label="워런 버핏",
                decision="HOLD",
                reason=(
                    f"{', '.join(hold_parts)} — 펀더멘탈 유지"
                    if hold_parts
                    else "장기 보유 관점 유지"
                ),
            )
        )

    return opinions
