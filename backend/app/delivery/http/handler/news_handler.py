from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.delivery.http.dependencies import provide_news_usecase
from app.delivery.http.dto.news_dto import (
    NewsItemDTO,
    SentimentHeatmapBinDTO,
    TrendingKeywordDTO,
)
from app.usecase.news_usecase import NewsUseCase

router = APIRouter(prefix="/stocks", tags=["news"])

keywords_router = APIRouter(prefix="/keywords", tags=["news"])


@router.get("/{symbol}/news", response_model=list[NewsItemDTO])
async def get_news(
    symbol: str,
    limit: int = Query(10, ge=1, le=30),
    uc: NewsUseCase = Depends(provide_news_usecase),
) -> list[NewsItemDTO]:
    items = await uc.get_news(symbol, limit=limit)
    return [NewsItemDTO.from_entity(i) for i in items]


@router.get("/{symbol}/sentiment", response_model=list[SentimentHeatmapBinDTO])
async def get_sentiment_heatmap(
    symbol: str,
    uc: NewsUseCase = Depends(provide_news_usecase),
) -> list[SentimentHeatmapBinDTO]:
    bins = await uc.get_sentiment_heatmap(symbol)
    return [SentimentHeatmapBinDTO.from_entity(b) for b in bins]


@keywords_router.get("/trending", response_model=list[TrendingKeywordDTO])
async def get_trending_keywords(
    symbol: str = Query(..., min_length=6),
    uc: NewsUseCase = Depends(provide_news_usecase),
) -> list[TrendingKeywordDTO]:
    keywords = await uc.get_trending_keywords(symbol)
    return [TrendingKeywordDTO.from_entity(k) for k in keywords]
