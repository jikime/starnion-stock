from __future__ import annotations

from fastapi import APIRouter, Depends

from app.delivery.http.dependencies import provide_indicator_usecase
from app.delivery.http.dto.indicator_dto import IndicatorsDTO
from app.usecase.indicator_usecase import IndicatorUseCase

router = APIRouter(prefix="/stocks", tags=["indicators"])


@router.get("/{symbol}/indicators", response_model=IndicatorsDTO)
async def get_indicators(
    symbol: str,
    uc: IndicatorUseCase = Depends(provide_indicator_usecase),
) -> IndicatorsDTO:
    indicators = await uc.get_indicators(symbol)
    return IndicatorsDTO.from_entity(indicators)
