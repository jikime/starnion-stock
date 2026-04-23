"""키워드 기반 1차 감성 분류기.

LLM 호출 전에 빠른 비용 0원 분류를 먼저 수행하여, 명확한 호재/악재 문장은
즉시 라벨링한다. LLM은 더 복잡한 맥락 해석에만 사용한다.
"""

from __future__ import annotations

from app.domain.entity.news import Sentiment


POSITIVE_KEYWORDS: tuple[str, ...] = (
    "호재",
    "상승",
    "강세",
    "신고가",
    "수출 증가",
    "수출 호조",
    "실적 개선",
    "실적 호조",
    "어닝 서프라이즈",
    "흑자 전환",
    "배당 확대",
    "증액",
    "목표주가 상향",
    "매수",
    "돌파",
    "수주",
    "호실적",
    "공급 계약",
    "순매수",
    "가속",
    "확대",
)

NEGATIVE_KEYWORDS: tuple[str, ...] = (
    "악재",
    "하락",
    "약세",
    "적자",
    "적자전환",
    "파업",
    "리콜",
    "규제",
    "제재",
    "감자",
    "유상증자",
    "목표주가 하향",
    "매도",
    "손실",
    "소송",
    "분쟁",
    "급락",
    "급감",
    "하향 조정",
    "경고",
    "디스카운트",
)

POSITIVE_EMOJI = {"호재", "+", "🟢"}
NEGATIVE_EMOJI = {"악재", "-", "🔴"}


def score_sentiment(text: str) -> tuple[Sentiment, float]:
    """텍스트를 분석하여 (감성 라벨, 스코어) 튜플 반환.

    스코어 범위: -1.0 ~ 1.0
    """

    if not text:
        return (Sentiment.NEUTRAL, 0.0)

    pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
    neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)
    total = pos + neg
    if total == 0:
        return (Sentiment.NEUTRAL, 0.0)

    score = (pos - neg) / total
    if score > 0.25:
        return (Sentiment.POSITIVE, score)
    if score < -0.25:
        return (Sentiment.NEGATIVE, score)
    return (Sentiment.NEUTRAL, score)


def extract_keywords(text: str, limit: int = 5) -> list[str]:
    """긍정/부정 키워드 중 텍스트에 나타난 것을 추출."""

    if not text:
        return []
    found: list[str] = []
    for kw in POSITIVE_KEYWORDS + NEGATIVE_KEYWORDS:
        if kw in text and kw not in found:
            found.append(kw)
        if len(found) >= limit:
            break
    return found
