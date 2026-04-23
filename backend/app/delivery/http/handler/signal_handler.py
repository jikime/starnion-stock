from __future__ import annotations

from fastapi import APIRouter, Depends

from app.delivery.http.dependencies import (
    provide_briefing_usecase,
    provide_signal_usecase,
)
from app.delivery.http.dto.indicator_dto import BriefingDTO, MomentumDTO, SignalDTO
from app.usecase.briefing_usecase import BriefingUseCase
from app.usecase.signal_usecase import SignalUseCase

router = APIRouter(prefix="/stocks", tags=["signals"])


@router.get("/{symbol}/signals", response_model=SignalDTO)
async def get_signal(
    symbol: str,
    uc: SignalUseCase = Depends(provide_signal_usecase),
) -> SignalDTO:
    signal = await uc.generate_signal(symbol)
    return SignalDTO.from_entity(signal)


@router.get("/{symbol}/momentum", response_model=MomentumDTO)
async def get_momentum(
    symbol: str,
    uc: SignalUseCase = Depends(provide_signal_usecase),
) -> MomentumDTO:
    score = await uc.get_momentum(symbol)
    return MomentumDTO(symbol=symbol, score=score)


@router.get("/{symbol}/briefing", response_model=BriefingDTO)
async def get_briefing(
    symbol: str,
    uc: BriefingUseCase = Depends(provide_briefing_usecase),
) -> BriefingDTO:
    result = await uc.generate(symbol)
    return BriefingDTO(
        symbol=result.symbol,
        stock_name=result.stock_name,
        message=result.message,
        signal_type=result.signal_type,
        momentum=result.momentum,
        target_price=result.target_price,
    )
