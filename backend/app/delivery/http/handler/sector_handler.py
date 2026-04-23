from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.delivery.http.dependencies import provide_sector_usecase
from app.delivery.http.dto.sector_dto import SectorRankDTO
from app.usecase.sector_usecase import SectorUseCase

router = APIRouter(prefix="/market", tags=["sectors"])


@router.get("/sectors", response_model=list[SectorRankDTO])
async def get_sectors(
    uc: SectorUseCase = Depends(provide_sector_usecase),
) -> list[SectorRankDTO]:
    """네이버 금융 업종(섹터) 등락률 — 등락률 내림차순."""

    try:
        rows = await uc.get_sectors()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"sectors fetch failed: {exc}"
        )
    return [SectorRankDTO.from_entity(r) for r in rows]
