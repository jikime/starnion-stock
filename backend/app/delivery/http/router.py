from fastapi import APIRouter

from app.delivery.http.handler import (
    ai_analysis_handler,
    disclosure_handler,
    exit_simulation_handler,
    indicator_handler,
    level_handler,
    macro_handler,
    market_briefing_handler,
    market_handler,
    master_score_handler,
    news_handler,
    sector_handler,
    signal_handler,
    stock_handler,
    trade_handler,
)


def create_api_router() -> APIRouter:
    api = APIRouter(prefix="/api")
    api.include_router(stock_handler.router)
    api.include_router(indicator_handler.router)
    api.include_router(news_handler.router)
    api.include_router(news_handler.keywords_router)
    api.include_router(disclosure_handler.router)
    api.include_router(signal_handler.router)
    api.include_router(market_handler.router)
    api.include_router(trade_handler.router)
    api.include_router(ai_analysis_handler.router)
    api.include_router(level_handler.router)
    api.include_router(macro_handler.router)
    api.include_router(master_score_handler.router)
    api.include_router(exit_simulation_handler.router)
    api.include_router(market_briefing_handler.router)
    api.include_router(sector_handler.router)
    return api
