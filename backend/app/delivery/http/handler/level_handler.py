from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.delivery.http.dependencies import provide_level_usecase
from app.delivery.http.dto.level_dto import PriceLevelsSnapshotDTO
from app.usecase.level_usecase import LevelUseCase

router = APIRouter(tags=["levels"])


@router.get(
    "/stocks/{symbol}/levels",
    response_model=PriceLevelsSnapshotDTO,
)
async def get_stock_levels(
    symbol: str,
    uc: LevelUseCase = Depends(provide_level_usecase),
) -> PriceLevelsSnapshotDTO:
    """스윙 포인트 + 가격 밀도 클러스터링으로 계산한 AI 지지/저항 레벨.

    캐시 TTL 30분. 종목당 최신 1개만 유지. 각 레벨에는 Claude 가
    생성한 한 문장 해설이 포함된다 (Claude 호출 실패 시 빈 문자열).
    """

    try:
        snapshot = await uc.get_levels(symbol)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"level computation failed: {exc}"
        )
    return PriceLevelsSnapshotDTO.from_entity(snapshot)
