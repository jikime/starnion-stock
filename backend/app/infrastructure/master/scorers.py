"""거장 3인의 스코어링 알고리즘 — Buffett / O'Neil / Livermore.

``docs/02`` 핵심 이론 + ``docs/04`` 한국형 가중치를 단일 모듈에 집약.
각 scorer 는 동일한 시그니처 ``score(fundamental, indicators, candles) -> MasterScore``
를 가진다.

스코어 산식은 의도적으로 단순하게 — 1차 MVP. 가중치/임계값은 상수로
모아두고 후속 작업에서 튜닝.
"""

from __future__ import annotations

from app.domain.entity.indicator import Indicators
from app.domain.entity.investor_flow import InvestorFlow
from app.domain.entity.master_score import FundamentalSnapshot, MasterScore
from app.domain.entity.stock import Candle


# ────────────────────────────────────────────────────────────────────────
# Buffett — 저평가 우량주
# ────────────────────────────────────────────────────────────────────────


def score_buffett(
    fundamental: FundamentalSnapshot,
    indicators: Indicators,
    candles: list[Candle],
) -> MasterScore:
    """버핏형 (docs/02) — ROE>15% + 부채비율<100% + 저PER + 배당.

    가중치:
      - ROE (30점): 핵심 수익성 지표
      - 부채비율 (20점): 안전성
      - PER (25점): 저평가
      - PBR (15점): 자산가치
      - 배당률 (10점)
    """

    score = 0
    reasons: list[str] = []

    roe = fundamental.roe
    debt = fundamental.debt_ratio
    per = fundamental.per
    pbr = fundamental.pbr
    dvr = fundamental.dividend_yield

    # ROE (30점) — docs/02 버핏 핵심 조건 ROE > 15%
    if roe is not None:
        if roe >= 15:
            score += 30
            reasons.append(f"ROE {roe:.1f}% 우수 (버핏 기준 통과)")
        elif roe >= 10:
            score += 20
            reasons.append(f"ROE {roe:.1f}% 양호")
        elif roe >= 5:
            score += 10
        else:
            reasons.append(f"ROE {roe:.1f}% 저조")

    # 부채비율 (20점) — docs/03 Debt_to_Equity 50/80/150 한국형 임계값
    # docs/03: 버핏은 보수적으로 80% 이하를 선호 (한국 상장사 평균 고려)
    if debt is not None:
        if debt < 50:
            score += 20
            reasons.append(f"부채비율 {debt:.0f}% 매우 안전")
        elif debt < 80:
            score += 14
            reasons.append(f"부채비율 {debt:.0f}% 안전 (버핏 기준)")
        elif debt < 150:
            score += 5
        else:
            reasons.append(f"부채비율 {debt:.0f}% 고위험")

    # PER (25점)
    if per is not None:
        if per < 10:
            score += 25
            reasons.append(f"PER {per:.1f} 매우 저평가")
        elif per < 15:
            score += 18
            reasons.append(f"PER {per:.1f} 저평가")
        elif per < 25:
            score += 8
        else:
            reasons.append(f"PER {per:.1f} 고평가")

    # PBR (15점)
    if pbr is not None:
        if pbr < 1:
            score += 15
        elif pbr < 2:
            score += 10
        elif pbr < 3:
            score += 5

    # 배당률 (10점)
    if dvr is not None:
        if dvr >= 3:
            score += 10
            reasons.append(f"배당률 {dvr:.1f}% 양호")
        elif dvr >= 1.5:
            score += 5

    score = max(0, min(100, score))
    return MasterScore(
        name="buffett",
        label="워런 버핏",
        score=score,
        signal=_to_signal(score),
        reasons=reasons[:4],
    )


# ────────────────────────────────────────────────────────────────────────
# O'Neil — 성장 모멘텀
# ────────────────────────────────────────────────────────────────────────


def score_oneill(
    fundamental: FundamentalSnapshot,
    indicators: Indicators,
    candles: list[Candle],
    investor_flow: InvestorFlow | None = None,
) -> MasterScore:
    """오닐형 CANSLIM (docs/02·03·04) — 이익·모멘텀·신고가·거래량·RSI + 외국인 수급.

    가중치 (docs/04 — 한국형 외국인 수급 20점 추가로 재조정):
      - 순이익 성장률 (20점): CAN SLIM 의 C — 분기 이익 > 25%
      - 가격 모멘텀 20일 (15점): 시장이 인정한 상승세
      - 신고가 근접 (20점): N — 신고가 (-10% 이내)
      - 거래량 급증 (15점): 'Strong Demand' 확인
      - RSI > 70 (10점): 시장 주도주(Leader) — docs/03
      - [한국형] 외국인 5일 순매수 (20점) — docs/04 "외국인 지분율 증가"
    """

    score = 0
    reasons: list[str] = []

    if not candles:
        return MasterScore(
            name="oneill",
            label="윌리엄 오닐",
            score=0,
            signal="HOLD",
            reasons=["캔들 데이터 부족"],
        )

    closes = [c.close for c in candles]
    highs = [c.high for c in candles]
    volumes = [c.volume for c in candles]
    last_close = closes[-1]

    # (C) 순이익 증가율 (20점) — docs/02·03 오닐 핵심 조건 >25%
    ni_growth = fundamental.net_income_growth
    if ni_growth is not None:
        if ni_growth > 50:
            score += 20
            reasons.append(f"순이익 YoY +{ni_growth:.0f}% 폭증 (CAN SLIM C)")
        elif ni_growth > 25:
            score += 15
            reasons.append(f"순이익 YoY +{ni_growth:.0f}% (기준 충족)")
        elif ni_growth > 10:
            score += 8
            reasons.append(f"순이익 YoY +{ni_growth:.0f}% 성장")
        elif ni_growth > 0:
            score += 3
        else:
            reasons.append(f"순이익 YoY {ni_growth:.0f}% 역성장")

    # 가격 모멘텀 20일 (15점)
    if len(closes) >= 21:
        m20 = closes[-21]
        chg_20d = (last_close - m20) / m20 * 100 if m20 else 0
        if chg_20d > 25:
            score += 15
            reasons.append(f"20일 +{chg_20d:.0f}% 강한 모멘텀")
        elif chg_20d > 10:
            score += 10
        elif chg_20d > 0:
            score += 4

    # (N) 신고가 근접 (20점) — docs/04 "52주 신고가 대비 -10% 이내"
    if len(highs) >= 60:
        period_high = max(highs[-min(252, len(highs)):])
        ratio = last_close / period_high if period_high else 0
        if ratio >= 0.95:
            score += 20
            reasons.append(f"고점 대비 {ratio*100:.0f}% — 신고가 근접 (CAN SLIM N)")
        elif ratio >= 0.90:
            score += 14
            reasons.append(f"고점 대비 {ratio*100:.0f}% (-10% 이내)")
        elif ratio >= 0.80:
            score += 6

    # 거래량 급증 (15점)
    if len(volumes) >= 25:
        recent5 = sum(volumes[-5:]) / 5
        prev20 = sum(volumes[-25:-5]) / 20
        ratio = recent5 / prev20 if prev20 else 0
        if ratio > 2.0:
            score += 15
            reasons.append(f"거래량 {ratio:.1f}× 폭증")
        elif ratio > 1.3:
            score += 10
            reasons.append(f"거래량 {ratio:.1f}× 증가")
        elif ratio > 1.0:
            score += 3

    # RSI > 70 (10점) — docs/03 시장 주도주(Leader) 지표
    # CAN SLIM 오닐: "시장 주도주는 대부분 RSI 70 이상에서 거래된다"
    rsi = indicators.rsi14
    if rsi is not None:
        if rsi > 80:
            score += 10
            reasons.append(f"RSI {rsi:.0f} 주도주 (과열 주의)")
        elif rsi > 70:
            score += 10
            reasons.append(f"RSI {rsi:.0f} 시장 주도주 (Leader)")
        elif rsi > 50:
            score += 5

    # [한국형] 외국인 5일 순매수 (20점) — docs/04 "외국인 지분율 증가"
    # 외인 연속 매수 일수와 5일 누적을 함께 평가
    if investor_flow is not None and investor_flow.days:
        net_5d = investor_flow.foreign_net_5d
        streak = investor_flow.foreign_net_streak
        if net_5d > 0 and streak >= 4:
            score += 20
            reasons.append(f"외인 {streak}일 연속 순매수 ({net_5d/10000:+,.0f}만주)")
        elif net_5d > 0 and streak >= 2:
            score += 14
            reasons.append(f"외인 5일 순매수 ({net_5d/10000:+,.0f}만주)")
        elif net_5d > 0:
            score += 7
        else:
            reasons.append(f"외인 5일 순매도 ({net_5d/10000:+,.0f}만주)")

    score = max(0, min(100, score))
    return MasterScore(
        name="oneill",
        label="윌리엄 오닐",
        score=score,
        signal=_to_signal(score),
        reasons=reasons[:4],
    )


# ────────────────────────────────────────────────────────────────────────
# Livermore — 추세/돌파
# ────────────────────────────────────────────────────────────────────────


def score_livermore(
    fundamental: FundamentalSnapshot,
    indicators: Indicators,
    candles: list[Candle],
) -> MasterScore:
    """리버모어형 (docs/03·04) — 한국형 추세 추종: 다중 MA 정배열 + 거래량 + 추세 강도.

    가중치 (docs/04 반영 — MA20/60/120/200 다중 정배열 + 거래량 ×2 추가):
      - [한국형] Price>MA20>MA60>MA120 다중 정배열 (25점) — docs/04
      - 4주 변화율 > 10% 추세 가속화 (15점) — docs/03
      - 피벗 R1 돌파 (15점) — docs/03
      - [한국형] 거래량 > 20일 평균 × 2.0 (20점) — docs/04 "전환점 확인"
      - ADX 추세 강도 (10점)
      - MACD 골든크로스 (15점)
    """

    score = 0
    reasons: list[str] = []

    sma20 = indicators.sma20
    sma60 = indicators.sma60
    sma120 = indicators.sma120
    sma200 = indicators.sma200
    close = indicators.close_price

    # (1) 한국형 다중 MA 정배열 (25점) — docs/04 "Price > MA20 & MA60 & MA120"
    # 단계별 점수: 5단 정배열 25 > 4단 18 > 3단(20/60/120) 13 > MA200 상회 8
    if close is not None:
        mas = [sma20, sma60, sma120, sma200]
        # 완벽 정배열 판정에 None 제외
        if all(m is not None for m in mas):
            if close > sma20 > sma60 > sma120 > sma200:  # type: ignore[operator]
                score += 25
                reasons.append(
                    f"MA20>60>120>200 완벽 정배열 (한국형)"
                )
            elif close > sma20 and sma20 > sma60 > sma120:  # type: ignore[operator]
                score += 18
                reasons.append(f"MA20>MA60>MA120 정배열 (docs/04)")
            elif close > sma60 and close > sma120:  # type: ignore[operator]
                score += 13
                reasons.append(f"MA60/MA120 상회 (중기 정배열)")
            elif close > sma200:  # type: ignore[operator]
                score += 8
                reasons.append(f"MA200 상회 (장기만 확보)")
            else:
                reasons.append("장기 추세 미확인 (MA200 하회)")
        elif sma60 is not None and sma120 is not None and close > sma60 > sma120:
            score += 13
            reasons.append(f"MA60>MA120 정배열 (MA200 데이터 부족)")
        elif sma20 is not None and close > sma20:
            score += 5
            reasons.append("MA20 상회")

    # (2) docs/03 — 4주 변화율 > 10% 추세 가속화 (15점)
    if candles and len(candles) >= 21:
        close_4w_ago = candles[-21].close
        if close_4w_ago and close is not None:
            chg_4w = (close - close_4w_ago) / close_4w_ago * 100
            if chg_4w > 20:
                score += 15
                reasons.append(f"4주 +{chg_4w:.1f}% 강한 가속")
            elif chg_4w > 10:
                score += 12
                reasons.append(f"4주 +{chg_4w:.1f}% 추세 가속화")
            elif chg_4w > 0:
                score += 5

    # (3) 피벗 포인트 돌파 (15점)
    pivot = indicators.pivot
    r1 = indicators.pivot_r1
    if close is not None and pivot is not None and r1 is not None:
        if close > r1:
            score += 15
            reasons.append(f"피벗 R1 ({int(r1):,}) 돌파")
        elif close > pivot:
            score += 8
            reasons.append(f"피벗 상회")

    # (4) [한국형] 거래량 > 20일 평균 × 2 (20점) — docs/04 "전환점 확인"
    if candles and len(candles) >= 21:
        vols = [c.volume for c in candles]
        recent_vol = vols[-1]
        avg20 = sum(vols[-21:-1]) / 20
        if avg20 > 0:
            vr = recent_vol / avg20
            if vr > 3.0:
                score += 20
                reasons.append(f"거래량 {vr:.1f}× 전환점 신호 (한국형)")
            elif vr > 2.0:
                score += 16
                reasons.append(f"거래량 {vr:.1f}× 폭발 (docs/04 기준)")
            elif vr > 1.3:
                score += 8
            elif vr > 0.7:
                score += 3

    # (5) ADX 추세 강도 (10점)
    adx = indicators.adx
    if adx is not None:
        if adx > 30:
            score += 10
            reasons.append(f"ADX {adx:.0f} 강한 추세")
        elif adx > 20:
            score += 6
            reasons.append(f"ADX {adx:.0f} 추세 형성")
        else:
            score += 1

    # (6) MACD 골든크로스 (15점)
    macd = indicators.macd
    macd_signal = indicators.macd_signal
    if macd is not None and macd_signal is not None:
        if macd > macd_signal:
            score += 15
            reasons.append("MACD 골든크로스")
        else:
            reasons.append("MACD 데드크로스")

    score = max(0, min(100, score))
    return MasterScore(
        name="livermore",
        label="제시 리버모어",
        score=score,
        signal=_to_signal(score),
        reasons=reasons[:4],
    )


# ────────────────────────────────────────────────────────────────────────
# helpers
# ────────────────────────────────────────────────────────────────────────


def _to_signal(score: int) -> str:
    """점수 → BUY/HOLD/SELL — docs/04 한국형 임계값 (>=70 BUY)."""

    if score >= 70:
        return "BUY"
    if score >= 40:
        return "HOLD"
    return "SELL"


def compute_star_score(
    buffett: int, oneill: int, livermore: int
) -> int:
    """``docs/03`` 통합 알고리즘 가중치 (0.3 / 0.4 / 0.3)."""

    return int(round(buffett * 0.3 + oneill * 0.4 + livermore * 0.3))


def _get_options_expiry(year: int, month: int) -> int:
    """해당 월의 옵션 만기일(둘째 주 목요일) 반환."""

    import calendar

    cal = calendar.Calendar(firstweekday=0)  # 월=0
    thursdays = [
        d
        for d in cal.itermonthdays2(year, month)
        if d[0] != 0 and d[1] == 3  # 목요일 = 3
    ]
    return thursdays[1][0]  # 둘째 주 목요일


def calendar_warnings() -> list[str]:
    """docs/09 §4 — 옵션 만기일 + 실적 발표 시즌 경고."""

    from datetime import date

    today = date.today()
    warnings: list[str] = []

    # 옵션 만기일 ±1일
    try:
        expiry_day = _get_options_expiry(today.year, today.month)
        diff = abs(today.day - expiry_day)
        if diff <= 1:
            warnings.append(
                f"옵션 만기일 근접 ({today.month}/{expiry_day}일) — 변동성 확대 주의"
            )
    except (IndexError, ValueError):
        pass

    # 실적 발표 시즌 (1/4/7/10월)
    if today.month in (1, 4, 7, 10):
        warnings.append(
            f"{today.month}월 실적 발표 시즌 — 컨센서스 대비 서프라이즈 주의"
        )

    return warnings


def macro_confirm_star_score(
    raw_star: int,
    buffett: int,
    oneill: int,
    livermore: int,
    usdkrw: float | None = None,
    vix: float | None = None,
    risk_level: str = "mid",
) -> tuple[int, list[str]]:
    """docs/09 — 매크로 컨펌: Star Score를 거시 환경으로 보정.

    Returns:
        (adjusted_star_score, macro_notes)

    Rules:
      - 환율 > 1400 → 전체 ×0.85 (외인 이탈 리스크)
      - 환율 > 1450 → 전체 ×0.7
      - VIX > 30 (극도 공포) → 리버모어 ×1.2 재계산 (역발상 기회)
      - risk_level == "high" → 전체 ×0.9
    """

    adjusted_b, adjusted_o, adjusted_l = float(buffett), float(oneill), float(livermore)
    notes: list[str] = []

    # 환율 필터
    if usdkrw is not None:
        if usdkrw > 1450:
            adjusted_b *= 0.7
            adjusted_o *= 0.7
            adjusted_l *= 0.7
            notes.append(f"환율 {usdkrw:,.0f}원 (>1450) — 점수 30% 차감")
        elif usdkrw > 1400:
            adjusted_b *= 0.85
            adjusted_o *= 0.85
            adjusted_l *= 0.85
            notes.append(f"환율 {usdkrw:,.0f}원 (>1400) — 점수 15% 차감")

    # VIX 극도 공포 → 리버모어 역발상
    if vix is not None and vix > 30:
        adjusted_l *= 1.2
        notes.append(f"VIX {vix:.0f} (극도 공포) — 리버모어 전환점 가중")

    # 종합 리스크
    if risk_level == "high" and not notes:
        adjusted_b *= 0.9
        adjusted_o *= 0.9
        adjusted_l *= 0.9
        notes.append("시장 리스크 '높음' — 보수적 접근")

    adjusted = int(round(
        adjusted_b * 0.3 + adjusted_o * 0.4 + adjusted_l * 0.3
    ))
    adjusted = max(0, min(100, adjusted))

    if not notes:
        notes.append("매크로 안정 — 타점 신뢰도 유지")

    return adjusted, notes


# ────────────────────────────────────────────────────────────────────────
# docs/03 — 3인 매칭 해설 (deterministic, Claude 불필요)
# ────────────────────────────────────────────────────────────────────────


_MASTER_PERSPECTIVE = {
    "buffett": "재무가치",
    "oneill": "성장·모멘텀",
    "livermore": "추세·돌파",
}


def _verdict(score: int) -> str:
    """점수 → 한국어 판정 (해설용)."""

    if score >= 80:
        return "완벽 부합"
    if score >= 70:
        return "강하게 부합"
    if score >= 55:
        return "부합"
    if score >= 40:
        return "보통"
    if score >= 25:
        return "미달"
    return "불일치"


def _josa_eun(word: str) -> str:
    """단어 받침 유무에 따라 '은/는' 선택."""

    last = word[-1]
    code = ord(last) - 0xAC00
    if code < 0 or code >= 11172:
        return "는"
    jongsung = code % 28
    return "은" if jongsung != 0 else "는"


def generate_commentary(
    buffett: int, oneill: int, livermore: int
) -> str:
    """docs/03 — 3인 매칭 해설 한 문장 생성.

    예) "재무가치는 버핏 기준 미달이지만, 추세·돌파 관점에서 완벽 부합 (85점)."

    최고/최저 관점을 대비해 투자자가 "어떤 거장의 눈"으로 이 종목을 봐야 할지 알려준다.
    """

    scored = [
        ("buffett", buffett),
        ("oneill", oneill),
        ("livermore", livermore),
    ]

    # 최고 점수 거장 + 최저 점수 거장 선택
    best_name, best_score = max(scored, key=lambda x: x[1])
    worst_name, worst_score = min(scored, key=lambda x: x[1])

    best_persp = _MASTER_PERSPECTIVE[best_name]
    best_verd = _verdict(best_score)

    # 편차가 작으면 (≤ 15) 세 관점 균형 서술
    if best_score - worst_score <= 15:
        if best_score >= 70:
            return f"3인 모두 일관되게 긍정 — {best_persp} 관점 {best_verd} (균형형)."
        if best_score >= 40:
            return "3인 평가 고루 중립 — 특별한 강점도, 약점도 없음."
        return "3인 모두 부정적 — 현재 매수 근거 약함."

    # 최고 vs 최저 대비 서술 — 받침 유무에 따라 은/는 선택
    worst_persp = _MASTER_PERSPECTIVE[worst_name]
    worst_verd = _verdict(worst_score)
    return (
        f"{worst_persp}{_josa_eun(worst_persp)} {worst_verd}, "
        f"{best_persp} 관점에서 {best_verd} ({best_score}점)."
    )
