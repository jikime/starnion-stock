"""매도 시뮬레이션 유즈케이스.

사용자가 입력한 ``entry_price`` 와 현재 시장 데이터를 결합하여 4단계 매도
신호 + 거장별 결정을 즉시 반환. 캐시 없음 (사용자 입력 의존, 30초 staleness
는 프론트 React Query 가 처리).
"""

from __future__ import annotations

from app.domain.entity.exit_simulation import ExitSimulation
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.exit.exit_calculator import calculate_exit
from app.infrastructure.indicator.calculator import IndicatorCalculator
from app.infrastructure.naver.fundamental_client import NaverFundamentalClient


class ExitSimulationUseCase:
    def __init__(
        self,
        stock_repo: StockRepository,
        fundamental_client: NaverFundamentalClient,
        indicator_calc: IndicatorCalculator,
    ) -> None:
        self.stock_repo = stock_repo
        self.fundamental_client = fundamental_client
        self.indicator_calc = indicator_calc

    async def simulate(
        self,
        symbol: str,
        entry_price: float,
        entry_date: str | None = None,
        stoploss_pct: float | None = None,
        target_pct: float | None = None,
    ) -> ExitSimulation:
        candles = await self.stock_repo.get_candles(symbol, "day", 60)
        price = await self.stock_repo.get_price(symbol)

        # docs/08: 상장폐지/거래정지 종목 예외 처리
        if not candles and price is None:
            raise ValueError(
                f"종목 '{symbol}' 데이터를 가져올 수 없습니다. "
                "상장폐지/거래정지 또는 잘못된 종목코드를 확인하세요."
            )

        indicators = self.indicator_calc.calculate_all(candles)

        if price is None:
            current_price = candles[-1].close if candles else entry_price
        else:
            current_price = float(price.current_price)

        fundamental = await self.fundamental_client.get_fundamental(symbol)

        result = calculate_exit(
            entry_price=entry_price,
            current_price=current_price,
            indicators=indicators,
            fundamental=fundamental,
            entry_date=entry_date,
            stoploss_pct=stoploss_pct,
            target_pct=target_pct,
        )
        result.symbol = symbol
        return result
