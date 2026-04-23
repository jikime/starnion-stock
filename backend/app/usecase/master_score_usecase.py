"""거장 3인 스코어 유즈케이스 — 캐시 → 펀더멘탈+지표+캔들 수집 → 3 scorer.

캐시 TTL 1시간. 시장 시간 외에는 펀더멘탈/지표가 잘 변하지 않으므로 안전.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from app.domain.entity.master_score import ForeignFlowPoint, MasterScores
from app.domain.repository.stock_repository import StockRepository
from app.infrastructure.indicator.calculator import IndicatorCalculator
from app.infrastructure.master.scorers import (
    calendar_warnings,
    compute_star_score,
    generate_commentary,
    macro_confirm_star_score,
    score_buffett,
    score_livermore,
    score_oneill,
)
from app.infrastructure.dart.financial_client import DartFinancialClient
from app.infrastructure.macro.macro_repository_impl import FdrMacroRepository
from app.infrastructure.naver.fundamental_client import NaverFundamentalClient
from app.infrastructure.naver.investor_flow_client import (
    NaverInvestorFlowClient,
)
from app.infrastructure.persistence.master_score_repository_impl import (
    SQLiteMasterScoreRepository,
)

logger = logging.getLogger(__name__)


CACHE_TTL = timedelta(hours=1)
CACHE_TTL_MARKET_HOURS = timedelta(minutes=5)  # 장중 5분 TTL


class MasterScoreUseCase:
    def __init__(
        self,
        repo: SQLiteMasterScoreRepository,
        stock_repo: StockRepository,
        fundamental_client: NaverFundamentalClient,
        indicator_calc: IndicatorCalculator,
        dart_financial_client: DartFinancialClient | None = None,
        investor_flow_client: NaverInvestorFlowClient | None = None,
        macro_repo: FdrMacroRepository | None = None,
    ) -> None:
        self.repo = repo
        self.stock_repo = stock_repo
        self.fundamental_client = fundamental_client
        self.indicator_calc = indicator_calc
        self.dart_financial_client = dart_financial_client
        self.investor_flow_client = investor_flow_client
        self.macro_repo = macro_repo

    async def get_scores(self, symbol: str) -> MasterScores:
        from app.infrastructure.stock.stock_repository_impl import (
            _is_kr_market_hours,
        )

        # 1. 캐시 확인 — 장중이면 5분, 장외면 1시간 TTL
        ttl = CACHE_TTL_MARKET_HOURS if _is_kr_market_hours() else CACHE_TTL
        cached = await self.repo.get_latest(symbol)
        if cached and (datetime.now() - cached.computed_at) < ttl:
            return cached

        # 2. 데이터 병렬 수집 — 독립적인 외부 호출 동시 실행
        # 200 봉 — 리버모어 MA200 계산을 위해 기본 120 에서 확장
        async def _safe_call(coro, name: str):
            try:
                return await coro
            except Exception as exc:  # noqa: BLE001
                logger.warning("%s failed for %s: %s", name, symbol, exc)
                return None

        # 병렬 실행
        tasks: list = [
            self.stock_repo.get_candles(symbol, "day", 220),
            self.stock_repo.get_price(symbol),
            self.fundamental_client.get_fundamental(symbol),
        ]
        if self.dart_financial_client is not None:
            tasks.append(
                _safe_call(
                    self.dart_financial_client.get_financials(symbol),
                    "dart financial",
                )
            )
        else:
            tasks.append(asyncio.sleep(0, result=None))
        if self.investor_flow_client is not None:
            tasks.append(
                _safe_call(
                    self.investor_flow_client.get_flow(symbol, days=7),
                    "investor_flow",
                )
            )
        else:
            tasks.append(asyncio.sleep(0, result=None))

        candles, price, fundamental, dart_data, investor_flow = (
            await asyncio.gather(*tasks)
        )

        # docs/08: 상장폐지/거래정지 종목 예외 처리
        if not candles and price is None:
            raise ValueError(
                f"종목 '{symbol}' 데이터를 가져올 수 없습니다. "
                "상장폐지/거래정지 또는 잘못된 종목코드를 확인하세요."
            )

        indicators = self.indicator_calc.calculate_all(candles)

        # DART 재무비율로 FundamentalSnapshot 보강
        if dart_data:
            fundamental.roe = dart_data.get("roe")
            fundamental.debt_ratio = dart_data.get("debt_ratio")
            fundamental.net_profit_margin = dart_data.get("net_profit_margin")
            fundamental.revenue_growth = dart_data.get("revenue_growth")
            fundamental.net_income_growth = dart_data.get("net_income_growth")
            fundamental.op_income_growth = dart_data.get("op_income_growth")

        stock_name = price.name if price else symbol

        # 3. 3 scorer 호출
        buffett = score_buffett(fundamental, indicators, candles)
        oneill = score_oneill(
            fundamental, indicators, candles, investor_flow=investor_flow
        )
        livermore = score_livermore(fundamental, indicators, candles)
        raw_star = compute_star_score(
            buffett.score, oneill.score, livermore.score
        )

        # docs/09 — 매크로 컨펌: 환율/VIX/리스크로 Star Score 보정
        macro_notes: list[str] = []
        star = raw_star
        if self.macro_repo is not None:
            try:
                macro = await self.macro_repo.get_snapshot()
                usdkrw = next(
                    (i.value for i in macro.indicators if i.code == "USD/KRW"),
                    None,
                )
                vix_val = next(
                    (i.value for i in macro.indicators if i.code == "VIX"),
                    None,
                )
                star, macro_notes = macro_confirm_star_score(
                    raw_star,
                    buffett.score,
                    oneill.score,
                    livermore.score,
                    usdkrw=usdkrw,
                    vix=vix_val,
                    risk_level=macro.risk_level,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("macro confirm failed: %s", exc)

        # docs/09 §4 — 캘린더 경고 (옵션 만기일 + 실적 시즌)
        macro_notes.extend(calendar_warnings())

        commentary = generate_commentary(
            buffett.score, oneill.score, livermore.score
        )

        # docs/04 외인 + docs/05 기관 — 5일 flow 시각화 데이터
        foreign_flow_pts: list[ForeignFlowPoint] = []
        institution_flow_pts: list[ForeignFlowPoint] = []
        if investor_flow is not None:
            for d in investor_flow.days[:5]:
                foreign_flow_pts.append(
                    ForeignFlowPoint(
                        date=d.trade_date.isoformat(),
                        net=d.foreign_net,
                    )
                )
                institution_flow_pts.append(
                    ForeignFlowPoint(
                        date=d.trade_date.isoformat(),
                        net=d.institution_net,
                    )
                )

        scores = MasterScores(
            symbol=symbol,
            stock_name=stock_name,
            buffett=buffett,
            oneill=oneill,
            livermore=livermore,
            star_score=star,
            fundamental=fundamental,
            computed_at=datetime.now(),
            commentary=commentary,
            foreign_flow=foreign_flow_pts,
            institution_flow=institution_flow_pts,
            macro_notes=macro_notes,
            volume_ratio=indicators.volume_ratio,
            retail_net_5d=(
                -(investor_flow.foreign_net_5d + investor_flow.institution_net_5d)
                if investor_flow is not None and investor_flow.days
                else None
            ),
        )

        # 4. 캐시 저장
        await self.repo.save(scores)
        return scores
