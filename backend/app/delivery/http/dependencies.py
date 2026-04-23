"""FastAPI 의존성 주입 계층.

모든 repository/calculator/usecase 인스턴스를 lru_cache 로 싱글톤화하여
FastAPI Depends 에서 사용한다.
"""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from app.infrastructure.dart.disclosure_repository_impl import (
    DartDisclosureRepository,
    get_dart_disclosure_repository,
)
from app.infrastructure.indicator.calculator import (
    IndicatorCalculator,
    get_indicator_calculator,
)
from app.infrastructure.indicator.level_detector import (
    LevelDetector,
    get_level_detector,
)
from app.infrastructure.macro.macro_repository_impl import (
    FdrMacroRepository,
    get_macro_repository,
)
from app.infrastructure.naver.fundamental_client import (
    NaverFundamentalClient,
    get_fundamental_client,
)
from app.infrastructure.persistence.market_briefing_repository_impl import (
    SQLiteMarketBriefingRepository,
    get_market_briefing_repository,
)
from app.infrastructure.persistence.master_score_repository_impl import (
    SQLiteMasterScoreRepository,
    get_master_score_repository,
)
from app.infrastructure.llm.llm_repository_impl import (
    LLMRepositoryImpl,
    get_llm_repository,
)
from app.infrastructure.naver.market_news_repository_impl import (
    NaverMarketNewsRepository,
    get_market_news_repository,
)
from app.infrastructure.naver.market_rank_client import (
    NaverMarketRankClient,
    get_naver_market_rank_client,
)
from app.infrastructure.naver.news_repository_impl import (
    NaverNewsRepository,
    get_naver_news_repository,
)
from app.infrastructure.llm.claude_client import ClaudeClient
from app.infrastructure.persistence.ai_analysis_repository_impl import (
    SQLiteAIAnalysisRepository,
    get_ai_analysis_repository,
)
from app.infrastructure.persistence.price_level_repository_impl import (
    SQLitePriceLevelRepository,
    get_price_level_repository,
)
from app.infrastructure.persistence.trade_repository_impl import (
    SQLiteTradeRepository,
    get_trade_repository,
)
from app.infrastructure.stock.stock_repository_impl import (
    PykrxStockRepository,
    get_pykrx_stock_repository,
)
from app.usecase.ai_analysis_usecase import AIAnalysisUseCase
from app.usecase.briefing_usecase import BriefingUseCase
from app.usecase.disclosure_usecase import DisclosureUseCase
from app.usecase.hot_stocks_usecase import HotStocksUseCase
from app.usecase.indicator_usecase import IndicatorUseCase
from app.usecase.level_usecase import LevelUseCase
from app.usecase.exit_simulation_usecase import ExitSimulationUseCase
from app.usecase.macro_usecase import MacroUseCase
from app.usecase.market_briefing_usecase import MarketBriefingUseCase
from app.usecase.market_news_usecase import MarketNewsUseCase
from app.usecase.master_score_usecase import MasterScoreUseCase
from app.usecase.news_usecase import NewsUseCase
from app.usecase.signal_usecase import SignalUseCase
from app.usecase.stock_usecase import StockUseCase
from app.usecase.trade_usecase import TradeUseCase


# ── Repository providers ─────────────────────────────────────────────────


def provide_stock_repo() -> PykrxStockRepository:
    return get_pykrx_stock_repository()


def provide_news_repo() -> NaverNewsRepository:
    return get_naver_news_repository()


def provide_disclosure_repo() -> DartDisclosureRepository:
    return get_dart_disclosure_repository()


def provide_trade_repo() -> SQLiteTradeRepository:
    return get_trade_repository()


def provide_ai_analysis_repo() -> SQLiteAIAnalysisRepository:
    return get_ai_analysis_repository()


def provide_price_level_repo() -> SQLitePriceLevelRepository:
    return get_price_level_repository()


def provide_level_detector() -> LevelDetector:
    return get_level_detector()


def provide_macro_repo() -> FdrMacroRepository:
    return get_macro_repository()


def provide_market_news_repo() -> NaverMarketNewsRepository:
    return get_market_news_repository()


def provide_master_score_repo() -> SQLiteMasterScoreRepository:
    return get_master_score_repository()


def provide_fundamental_client() -> NaverFundamentalClient:
    return get_fundamental_client()


def provide_market_briefing_repo() -> SQLiteMarketBriefingRepository:
    return get_market_briefing_repository()


# ── 신규 Usecase providers (대시보드 확장) ────────────────────────────────


def provide_macro_usecase(
    macro_repo: FdrMacroRepository = Depends(provide_macro_repo),
) -> MacroUseCase:
    return MacroUseCase(macro_repo)


def provide_market_news_usecase(
    repo: NaverMarketNewsRepository = Depends(provide_market_news_repo),
) -> MarketNewsUseCase:
    return MarketNewsUseCase(repo)


@lru_cache(maxsize=1)
def _sector_usecase_singleton():
    from app.infrastructure.naver.sector_client import (
        get_naver_sector_client,
    )
    from app.usecase.sector_usecase import SectorUseCase

    return SectorUseCase(client=get_naver_sector_client())


def provide_sector_usecase():
    return _sector_usecase_singleton()


# 아래 provide_master_score_usecase / provide_exit_simulation_usecase /
# provide_market_briefing_usecase 는 provide_indicator_calc,
# provide_market_rank_client, provide_claude_client 정의 이후로 옮겨야 한다
# (Python default 값 평가 순서 의존). 파일 하단에 배치.


@lru_cache(maxsize=1)
def _claude_client_singleton() -> ClaudeClient:
    return ClaudeClient()


def provide_claude_client() -> ClaudeClient:
    return _claude_client_singleton()


def provide_llm_repo() -> LLMRepositoryImpl:
    return get_llm_repository()


def provide_indicator_calc() -> IndicatorCalculator:
    return get_indicator_calculator()


def provide_market_rank_client() -> NaverMarketRankClient:
    return get_naver_market_rank_client()


# ── Usecase providers ────────────────────────────────────────────────────


def provide_stock_usecase(
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    market_rank_client: NaverMarketRankClient = Depends(
        provide_market_rank_client
    ),
) -> StockUseCase:
    return StockUseCase(stock_repo, market_rank_client)


def provide_indicator_usecase(
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    calc: IndicatorCalculator = Depends(provide_indicator_calc),
) -> IndicatorUseCase:
    return IndicatorUseCase(stock_repo, calc)


def provide_news_usecase(
    news_repo: NaverNewsRepository = Depends(provide_news_repo),
    llm_repo: LLMRepositoryImpl = Depends(provide_llm_repo),
) -> NewsUseCase:
    return NewsUseCase(news_repo, llm_repo)


def provide_disclosure_usecase(
    disclosure_repo: DartDisclosureRepository = Depends(provide_disclosure_repo),
) -> DisclosureUseCase:
    return DisclosureUseCase(disclosure_repo)


@lru_cache(maxsize=1)
def _signal_usecase_singleton() -> SignalUseCase:
    from app.infrastructure.naver.investor_flow_client import (
        get_investor_flow_client,
    )

    stock_repo = get_pykrx_stock_repository()
    news_repo = get_naver_news_repository()
    llm_repo = get_llm_repository()
    calc = get_indicator_calculator()
    news_uc = NewsUseCase(news_repo, llm_repo)
    return SignalUseCase(
        stock_repo,
        news_repo,
        news_uc,
        calc,
        investor_flow_client=get_investor_flow_client(),
        macro_repo=get_macro_repository(),
        claude_client=_claude_client_singleton(),
    )


def provide_signal_usecase() -> SignalUseCase:
    return _signal_usecase_singleton()


def provide_trade_usecase(
    trade_repo: SQLiteTradeRepository = Depends(provide_trade_repo),
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
) -> TradeUseCase:
    return TradeUseCase(trade_repo, stock_repo)


def provide_briefing_usecase(
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    llm_repo: LLMRepositoryImpl = Depends(provide_llm_repo),
    signal_uc: SignalUseCase = Depends(provide_signal_usecase),
) -> BriefingUseCase:
    return BriefingUseCase(stock_repo, llm_repo, signal_uc)


def provide_ai_analysis_usecase(
    repo: SQLiteAIAnalysisRepository = Depends(provide_ai_analysis_repo),
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    disclosure_repo: DartDisclosureRepository = Depends(provide_disclosure_repo),
    news_uc: NewsUseCase = Depends(provide_news_usecase),
    claude: ClaudeClient = Depends(provide_claude_client),
    calc: IndicatorCalculator = Depends(provide_indicator_calc),
) -> AIAnalysisUseCase:
    return AIAnalysisUseCase(
        repo=repo,
        stock_repo=stock_repo,
        disclosure_repo=disclosure_repo,
        news_usecase=news_uc,
        claude_client=claude,
        indicator_calc=calc,
    )


def provide_level_usecase(
    level_repo: SQLitePriceLevelRepository = Depends(provide_price_level_repo),
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    news_uc: NewsUseCase = Depends(provide_news_usecase),
    detector: LevelDetector = Depends(provide_level_detector),
    claude: ClaudeClient = Depends(provide_claude_client),
) -> LevelUseCase:
    return LevelUseCase(
        level_repo=level_repo,
        stock_repo=stock_repo,
        news_usecase=news_uc,
        detector=detector,
        claude_client=claude,
    )


def provide_hot_stocks_usecase(
    naver_client: NaverMarketRankClient = Depends(provide_market_rank_client),
) -> HotStocksUseCase:
    return HotStocksUseCase(naver_client)


# ── A5/A6/A7 Usecase providers (helper providers 정의 이후로 배치) ─────


def provide_master_score_usecase(
    repo: SQLiteMasterScoreRepository = Depends(provide_master_score_repo),
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    fundamental_client: NaverFundamentalClient = Depends(
        provide_fundamental_client
    ),
    calc: IndicatorCalculator = Depends(provide_indicator_calc),
) -> MasterScoreUseCase:
    from app.infrastructure.dart.financial_client import (
        get_dart_financial_client,
    )
    from app.infrastructure.naver.investor_flow_client import (
        get_investor_flow_client,
    )

    return MasterScoreUseCase(
        repo=repo,
        stock_repo=stock_repo,
        fundamental_client=fundamental_client,
        indicator_calc=calc,
        dart_financial_client=get_dart_financial_client(),
        investor_flow_client=get_investor_flow_client(),
        macro_repo=get_macro_repository(),
    )


def provide_exit_simulation_usecase(
    stock_repo: PykrxStockRepository = Depends(provide_stock_repo),
    fundamental_client: NaverFundamentalClient = Depends(
        provide_fundamental_client
    ),
    calc: IndicatorCalculator = Depends(provide_indicator_calc),
) -> ExitSimulationUseCase:
    return ExitSimulationUseCase(
        stock_repo=stock_repo,
        fundamental_client=fundamental_client,
        indicator_calc=calc,
    )


def provide_market_briefing_usecase(
    repo: SQLiteMarketBriefingRepository = Depends(provide_market_briefing_repo),
    macro_repo: FdrMacroRepository = Depends(provide_macro_repo),
    news_repo: NaverMarketNewsRepository = Depends(provide_market_news_repo),
    rank_client: NaverMarketRankClient = Depends(provide_market_rank_client),
    claude: ClaudeClient = Depends(provide_claude_client),
) -> MarketBriefingUseCase:
    from app.infrastructure.naver.sector_client import (
        get_naver_sector_client,
    )

    return MarketBriefingUseCase(
        repo=repo,
        macro_repo=macro_repo,
        news_repo=news_repo,
        rank_client=rank_client,
        claude_client=claude,
        sector_client=get_naver_sector_client(),
    )
