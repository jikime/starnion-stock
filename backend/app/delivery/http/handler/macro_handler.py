from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.delivery.http.dependencies import provide_macro_usecase
from app.delivery.http.dto.macro_dto import MacroSnapshotDTO
from app.usecase.macro_usecase import MacroUseCase

router = APIRouter(prefix="/macro", tags=["macro"])


@router.get("/snapshot", response_model=MacroSnapshotDTO)
async def get_macro_snapshot(
    uc: MacroUseCase = Depends(provide_macro_usecase),
) -> MacroSnapshotDTO:
    """대시보드용 매크로 스냅샷 (USD/KRW, KOSPI, VIX, WTI, Fear&Greed).

    5분 in-memory 캐시. ``risk_level`` 은 종합 평가(low/mid/high).
    """

    try:
        snapshot = await uc.get_snapshot()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"macro fetch failed: {exc}"
        )
    return MacroSnapshotDTO.from_entity(snapshot)
