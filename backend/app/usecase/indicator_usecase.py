"""Indicator 유즈케이스. OHLCV 조회 후 지표 계산."""

from __future__ import annotations

from app.domain.entity.indicator import Indicators
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.indicator.calculator import IndicatorCalculator


class IndicatorUseCase:
    def __init__(
        self, stock_repo: StockRepository, calculator: IndicatorCalculator
    ) -> None:
        self.stock_repo = stock_repo
        self.calculator = calculator

    async def get_indicators(self, symbol: str, count: int = 120) -> Indicators:
        candles = await self.stock_repo.get_candles(symbol, count=count)
        return self.calculator.calculate_all(candles)
