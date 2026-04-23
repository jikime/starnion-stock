"""AI 지지/저항 레벨 유즈케이스 — 하이브리드 (알고리즘 + Claude 해설).

파이프라인:
1. ``PriceLevelRepository`` 캐시 조회 (TTL 30분 이내면 바로 반환)
2. 캐시 미스 → ``stock_repo.get_candles`` 로 120봉 로드
3. ``LevelDetector`` 가 스윙+클러스터링으로 후보 레벨 계산 (순수 알고리즘)
4. 후보가 있으면 최근 뉴스와 함께 Claude 에게 한 문장 해설 요청
5. 결과를 ``PriceLevel`` 로 조립 → 캐시 저장 → 반환

Claude 호출이 실패해도 알고리즘 결과는 그대로 반환한다 (graceful degrade).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from app.domain.entity.price_level import PriceLevel, PriceLevelsSnapshot
from app.domain.repository.price_level_repository import PriceLevelRepository
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.indicator.level_detector import LevelDetector
from app.infrastructure.llm.claude_client import ClaudeClient
from app.usecase.news_usecase import NewsUseCase

logger = logging.getLogger(__name__)


CACHE_TTL = timedelta(minutes=30)
"""캐시 수명 — 동일 종목을 이 시간 이내 재조회하면 DB 캐시를 재사용."""

PRICE_DRIFT_TOLERANCE = 0.02
"""현재가가 캐시 시점 대비 이 비율 이상 변했으면 재계산 (2% = 하루 등락폭 수준)."""


class LevelUseCase:
    def __init__(
        self,
        level_repo: PriceLevelRepository,
        stock_repo: StockRepository,
        news_usecase: NewsUseCase,
        detector: LevelDetector,
        claude_client: ClaudeClient,
    ) -> None:
        self.level_repo = level_repo
        self.stock_repo = stock_repo
        self.news_usecase = news_usecase
        self.detector = detector
        self.claude_client = claude_client

    async def get_levels(self, symbol: str) -> PriceLevelsSnapshot:
        """해당 종목의 S/R 레벨 스냅샷 반환 — 캐시 우선."""

        # 1. 현재가 먼저 조회 (캐시 유효성 판정에도 필요)
        price = await self.stock_repo.get_price(symbol)
        if price is None:
            return PriceLevelsSnapshot(
                symbol=symbol,
                current_price=0.0,
                levels=[],
                computed_at=datetime.now(),
            )
        current_price = float(price.current_price)
        stock_name = price.name

        # 2. 캐시 조회
        cached = await self.level_repo.get_latest(symbol)
        if cached and _is_cache_fresh(cached, current_price):
            logger.debug("level cache hit for %s", symbol)
            return cached

        # 3. 캔들 로드 + 알고리즘 탐지
        candles = await self.stock_repo.get_candles(symbol, "day", 120)
        detected = self.detector.detect(
            candles, current_price=current_price, max_levels=4
        )
        if not detected:
            snapshot = PriceLevelsSnapshot(
                symbol=symbol,
                current_price=current_price,
                levels=[],
                computed_at=datetime.now(),
            )
            await self.level_repo.save(snapshot)
            return snapshot

        # 4. Claude 해설 (실패해도 알고리즘 결과는 살린다)
        explanations: dict[float, str] = {}
        try:
            news = await self.news_usecase.get_news(symbol, limit=8)
            explanations = await self.claude_client.explain_levels(
                stock_name=stock_name,
                symbol=symbol,
                current_price=current_price,
                levels=detected,
                news=news,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Claude level explanation failed for %s: %s", symbol, exc
            )

        # 5. 엔티티 조립 — explanations 매핑은 가장 가까운 price 로 매칭
        levels: list[PriceLevel] = []
        for d in detected:
            explanation = _match_explanation(d.price, explanations)
            levels.append(
                PriceLevel(
                    price=d.price,
                    kind=d.kind,
                    touch_count=d.touch_count,
                    strength=d.strength,
                    explanation=explanation,
                )
            )

        snapshot = PriceLevelsSnapshot(
            symbol=symbol,
            current_price=current_price,
            levels=levels,
            computed_at=datetime.now(),
        )
        await self.level_repo.save(snapshot)
        return snapshot


def _is_cache_fresh(
    cached: PriceLevelsSnapshot, current_price: float
) -> bool:
    age = datetime.now() - cached.computed_at
    if age > CACHE_TTL:
        return False
    if cached.current_price <= 0:
        return False
    drift = abs(current_price - cached.current_price) / cached.current_price
    return drift < PRICE_DRIFT_TOLERANCE


def _match_explanation(
    price: float, explanations: dict[float, str]
) -> str:
    """``price`` 가 캔들 평균이라 LLM 응답의 정확한 수치와 1~2원 오차가
    날 수 있다. 가장 가까운 키를 찾아 매칭한다."""

    if not explanations:
        return ""
    target = round(price, 2)
    if target in explanations:
        return explanations[target]
    best_key = min(explanations.keys(), key=lambda k: abs(k - price))
    if abs(best_key - price) / max(price, 1.0) < 0.01:
        return explanations[best_key]
    return ""
