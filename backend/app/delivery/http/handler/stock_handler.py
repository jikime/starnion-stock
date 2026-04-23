from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.delivery.http.dependencies import provide_stock_usecase
from app.delivery.http.dto.stock_dto import (
    CandleDTO,
    FundamentalDTO,
    StockDTO,
    StockPriceDTO,
)
from app.usecase.stock_usecase import StockUseCase

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("", response_model=list[StockDTO])
async def list_stocks(
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> list[StockDTO]:
    stocks = await uc.list_all()
    return [StockDTO.from_entity(s) for s in stocks]


@router.get("/search", response_model=list[StockDTO])
async def search_stocks(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> list[StockDTO]:
    stocks = await uc.search(q, limit=limit)
    return [StockDTO.from_entity(s) for s in stocks]


@router.get("/{symbol}/price", response_model=StockPriceDTO)
async def get_price(
    symbol: str,
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> StockPriceDTO:
    price = await uc.get_price(symbol)
    if price is None:
        raise HTTPException(status_code=404, detail="price not found")
    return StockPriceDTO.from_entity(price)


@router.get("/{symbol}/candles", response_model=list[CandleDTO])
async def get_candles(
    symbol: str,
    period: str = Query("day"),
    count: int = Query(120, ge=1, le=2000),
    before: str | None = Query(
        None,
        description="ISO datetime (YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS). "
        "지정 시 해당 시각 이전 캔들만 반환 (pan 과거 로드용).",
    ),
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> list[CandleDTO]:
    # period 별 상한 가드 — 분봉은 500 이하로 제한 (일봉 2000 까지)
    p = period.lower()
    if p in ("1min", "5min", "15min", "30min", "60min") and count > 500:
        raise HTTPException(
            status_code=400,
            detail=f"분봉({period})은 최대 500봉까지 요청 가능합니다.",
        )

    before_dt: datetime | None = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"invalid before datetime: {before}"
            )

    candles = await uc.get_candles(
        symbol, period=period, count=count, before=before_dt
    )
    return [CandleDTO.from_entity(c) for c in candles]


@router.get("/{symbol}/fundamental", response_model=FundamentalDTO)
async def get_fundamental(
    symbol: str,
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> FundamentalDTO:
    fundamental = await uc.get_fundamental(symbol)
    if fundamental is None:
        raise HTTPException(status_code=404, detail="fundamental not found")
    return FundamentalDTO.from_entity(fundamental)
