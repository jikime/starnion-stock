from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.delivery.http.dependencies import provide_market_briefing_usecase
from app.delivery.http.dto.market_briefing_dto import MarketBriefingDTO
from app.usecase.market_briefing_usecase import MarketBriefingUseCase

router = APIRouter(prefix="/market", tags=["market-briefing"])


@router.get("/briefing", response_model=MarketBriefingDTO)
async def get_market_briefing(
    force: bool = Query(
        False,
        description="true 면 캐시 무시하고 Claude 재호출 (수동 새로고침용)",
    ),
    uc: MarketBriefingUseCase = Depends(provide_market_briefing_usecase),
) -> MarketBriefingDTO:
    """오늘의 AI 시장 일일 브리핑 (1일 1회 SQLite 캐시).

    매크로(환율/금리/VIX) + 거래대금 상위 10종목 + 메인 뉴스 10건을 종합해
    Claude 가 한국어 브리핑 + 강세/약세 섹터를 생성한다.
    """

    try:
        briefing = await uc.get_briefing(force=force)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"market briefing failed: {exc}"
        )
    return MarketBriefingDTO.from_entity(briefing)
