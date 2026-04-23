from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.delivery.http.dependencies import provide_master_score_usecase
from app.delivery.http.dto.master_score_dto import MasterScoresDTO
from app.usecase.master_score_usecase import MasterScoreUseCase

router = APIRouter(prefix="/stocks", tags=["master-scores"])


@router.get(
    "/{symbol}/master-scores",
    response_model=MasterScoresDTO,
)
async def get_master_scores(
    symbol: str,
    uc: MasterScoreUseCase = Depends(provide_master_score_usecase),
) -> MasterScoresDTO:
    """버핏/오닐/리버모어 3인 멀티팩터 스코어 + Star Score (가중평균).

    1시간 캐시. 첫 호출 시 펀더멘탈 스크랩 포함 1~3초.
    """

    try:
        scores = await uc.get_scores(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"master score failed: {exc}"
        )
    return MasterScoresDTO.from_entity(scores)
