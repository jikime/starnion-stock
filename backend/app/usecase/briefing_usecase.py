"""AI 브리핑 생성 유즈케이스."""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.repository.llm_repository import LLMRepository
from app.domain.repository.stock_repository import StockRepository
from app.usecase.signal_usecase import SignalUseCase


@dataclass
class BriefingResult:
    symbol: str
    stock_name: str
    message: str
    signal_type: str
    momentum: int
    target_price: float | None


class BriefingUseCase:
    def __init__(
        self,
        stock_repo: StockRepository,
        llm_repo: LLMRepository,
        signal_usecase: SignalUseCase,
    ) -> None:
        self.stock_repo = stock_repo
        self.llm_repo = llm_repo
        self.signal_usecase = signal_usecase

    async def generate(self, symbol: str) -> BriefingResult:
        signal = await self.signal_usecase.generate_signal(symbol)
        price_entity = await self.stock_repo.get_price(symbol)
        stock_name = price_entity.name if price_entity else symbol
        current_price = price_entity.current_price if price_entity else 0.0

        message = await self.llm_repo.generate_briefing(
            signal_type=signal.type,
            stock_name=stock_name,
            current_price=current_price,
            target_price=signal.target_price,
            reasons=signal.reasons,
        )
        if not message:
            message = _fallback_message(stock_name, signal.type, current_price, signal.target_price)

        return BriefingResult(
            symbol=symbol,
            stock_name=stock_name,
            message=message,
            signal_type=signal.type,
            momentum=signal.momentum,
            target_price=signal.target_price,
        )


def _fallback_message(
    stock_name: str, signal_type: str, price: float, target: float | None
) -> str:
    """LLM 호출 실패 시 기본 메시지."""

    if signal_type == "BUY":
        if target:
            return (
                f"{stock_name}가 AI가 계산한 매수 존 {int(target):,}원에 접근 중입니다."
            )
        return f"{stock_name}에 매수 시그널이 감지되었습니다."
    if signal_type == "SELL":
        return f"{stock_name}에서 과매수 시그널이 감지되었습니다. 단기 조정에 유의하세요."
    return f"{stock_name}는 현재 관망 구간입니다. (현재가 {int(price):,}원)"
