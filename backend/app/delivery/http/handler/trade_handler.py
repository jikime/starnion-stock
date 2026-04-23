from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.delivery.http.dependencies import provide_trade_usecase
from app.delivery.http.dto.trade_dto import TradeCreateDTO, TradeDTO
from app.usecase.trade_usecase import TradeUseCase

router = APIRouter(prefix="/trades", tags=["trades"])


@router.get("", response_model=list[TradeDTO])
async def list_trades(
    uc: TradeUseCase = Depends(provide_trade_usecase),
) -> list[TradeDTO]:
    items = await uc.list()
    return [TradeDTO.from_entity(i) for i in items]


@router.post("", response_model=TradeDTO, status_code=201)
async def create_trade(
    payload: TradeCreateDTO,
    uc: TradeUseCase = Depends(provide_trade_usecase),
) -> TradeDTO:
    created = await uc.create(payload.to_entity())
    return TradeDTO.from_entity(created)


@router.put("/{trade_id}", response_model=TradeDTO)
async def update_trade(
    trade_id: str,
    payload: TradeCreateDTO,
    uc: TradeUseCase = Depends(provide_trade_usecase),
) -> TradeDTO:
    entity = payload.to_entity()
    entity.id = trade_id
    updated = await uc.update(trade_id, entity)
    if updated is None:
        raise HTTPException(status_code=404, detail="trade not found")
    return TradeDTO.from_entity(updated)


@router.delete("/{trade_id}", status_code=204)
async def delete_trade(
    trade_id: str,
    uc: TradeUseCase = Depends(provide_trade_usecase),
) -> None:
    ok = await uc.delete(trade_id)
    if not ok:
        raise HTTPException(status_code=404, detail="trade not found")
