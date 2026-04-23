from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.delivery.http.dependencies import provide_disclosure_usecase
from app.delivery.http.dto.disclosure_dto import DisclosureDTO, DividendInfoDTO
from app.usecase.disclosure_usecase import DisclosureUseCase

router = APIRouter(prefix="/stocks", tags=["disclosures"])


@router.get("/{symbol}/disclosures", response_model=list[DisclosureDTO])
async def list_disclosures(
    symbol: str,
    days: int = Query(30, ge=1, le=365),
    uc: DisclosureUseCase = Depends(provide_disclosure_usecase),
) -> list[DisclosureDTO]:
    items = await uc.list_recent(symbol, days=days)
    return [DisclosureDTO.from_entity(i) for i in items]


@router.get("/{symbol}/dividends", response_model=list[DividendInfoDTO])
async def get_dividends(
    symbol: str,
    year: int | None = Query(None),
    uc: DisclosureUseCase = Depends(provide_disclosure_usecase),
) -> list[DividendInfoDTO]:
    items = await uc.get_dividends(symbol, year=year)
    return [DividendInfoDTO.from_entity(i) for i in items]
