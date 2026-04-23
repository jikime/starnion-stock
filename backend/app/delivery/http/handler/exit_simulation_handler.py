from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.delivery.http.dependencies import provide_exit_simulation_usecase
from app.delivery.http.dto.exit_simulation_dto import ExitSimulationDTO
from app.usecase.exit_simulation_usecase import ExitSimulationUseCase

router = APIRouter(prefix="/stocks", tags=["exit-simulation"])


@router.get(
    "/{symbol}/exit-simulation",
    response_model=ExitSimulationDTO,
)
async def get_exit_simulation(
    symbol: str,
    entry_price: float = Query(
        ..., gt=0, description="사용자 매수가 (원). 평가손익 기준점."
    ),
    entry_date: str | None = Query(
        None,
        description="매수일 ISO (YYYY-MM-DD). 오닐 3주 급등 예외 판단용.",
    ),
    stoploss_pct: float | None = Query(
        None,
        description="커스텀 손절선 % (음수, 예: -5). 미지정 시 기본 -7%.",
    ),
    target_pct: float | None = Query(
        None,
        description="커스텀 익절선 % (양수, 예: 25). 미지정 시 기본 20%.",
    ),
    uc: ExitSimulationUseCase = Depends(provide_exit_simulation_usecase),
) -> ExitSimulationDTO:
    """매도 시뮬레이터 — 4단계 시그널(손절/추세/과열/목표) + 거장 3인 결정."""

    try:
        sim = await uc.simulate(
            symbol,
            entry_price,
            entry_date=entry_date,
            stoploss_pct=stoploss_pct,
            target_pct=target_pct,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"exit simulation failed: {exc}"
        )
    return ExitSimulationDTO.from_entity(sim)
