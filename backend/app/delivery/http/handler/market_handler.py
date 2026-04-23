from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.delivery.http.dependencies import (
    provide_disclosure_usecase,
    provide_hot_stocks_usecase,
    provide_market_news_usecase,
    provide_stock_usecase,
)
from app.delivery.http.dto.disclosure_dto import DisclosureDTO
from app.delivery.http.dto.hot_stocks_dto import HotStockDTO
from app.delivery.http.dto.market_news_dto import MarketNewsItemDTO
from app.delivery.http.dto.stock_dto import StockDTO, StockPriceDTO
from app.usecase.disclosure_usecase import DisclosureUseCase
from app.usecase.hot_stocks_usecase import HotStocksUseCase
from app.usecase.market_news_usecase import MarketNewsUseCase
from app.usecase.stock_usecase import StockUseCase

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/tickers", response_model=list[StockPriceDTO])
async def get_market_tickers(
    symbols: str | None = Query(
        None,
        description="콤마로 구분된 종목 코드 목록 (옵션). 예: 005930,000660,035420",
    ),
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> list[StockPriceDTO]:
    watchlist = [s.strip() for s in symbols.split(",")] if symbols else None
    tickers = await uc.get_market_tickers(watchlist=watchlist)
    return [StockPriceDTO.from_entity(t) for t in tickers]


@router.get("/top-market-cap", response_model=list[StockDTO])
async def get_top_market_cap(
    market: str = Query("KOSPI", description="KOSPI 또는 KOSDAQ"),
    limit: int = Query(10, ge=1, le=50),
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> list[StockDTO]:
    """시가총액 상위 N개 종목 (네이버 금융 랭킹 페이지 기반)."""

    stocks = await uc.get_top_market_cap(market=market, limit=limit)
    return [StockDTO.from_entity(s) for s in stocks]


@router.get("/index-constituents", response_model=list[StockDTO])
async def get_index_constituents(
    index_code: str = Query(
        "KPI200",
        description="네이버 지수 코드 (KPI200=코스피200, KPI100=코스피100, KOSDAQ150=코스닥150)",
    ),
    limit: int = Query(30, ge=1, le=200),
    uc: StockUseCase = Depends(provide_stock_usecase),
) -> list[StockDTO]:
    """지수 구성종목 상위 N개 (네이버 금융 구성종목 페이지 기반)."""

    stocks = await uc.get_index_constituents(
        index_code=index_code, limit=limit
    )
    return [StockDTO.from_entity(s) for s in stocks]


@router.get("/hot-stocks", response_model=list[HotStockDTO])
async def get_hot_stocks(
    metric: str = Query(
        "value",
        description="value(거래대금) | volume(거래량) | change(상승률)",
    ),
    market: str = Query("KOSPI", description="KOSPI 또는 KOSDAQ"),
    limit: int = Query(20, ge=1, le=50),
    uc: HotStocksUseCase = Depends(provide_hot_stocks_usecase),
) -> list[HotStockDTO]:
    """오늘의 인기 종목 랭킹 — 거래대금 / 거래량 / 상승률 상위 N개."""

    rows = await uc.get_hot_stocks(metric=metric, market=market, limit=limit)
    return [HotStockDTO.from_entity(r) for r in rows]


@router.get("/news", response_model=list[MarketNewsItemDTO])
async def get_market_news(
    limit: int = Query(20, ge=1, le=50),
    uc: MarketNewsUseCase = Depends(provide_market_news_usecase),
) -> list[MarketNewsItemDTO]:
    """시장 메인 뉴스 (네이버 finance/news/mainnews.naver) — 종목 무관."""

    items = await uc.get_news(limit=limit)
    return [MarketNewsItemDTO.from_entity(i) for i in items]


@router.get("/disclosures", response_model=list[DisclosureDTO])
async def get_market_disclosures(
    days: int = Query(1, ge=1, le=7),
    limit: int = Query(30, ge=1, le=100),
    uc: DisclosureUseCase = Depends(provide_disclosure_usecase),
) -> list[DisclosureDTO]:
    """전 종목 최근 N일 DART 공시 — 종목 무관."""

    items = await uc.list_all_recent(days=days, limit=limit)
    return [DisclosureDTO.from_entity(i) for i in items]
