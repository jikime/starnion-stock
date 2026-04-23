from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.delivery.http.dependencies import provide_ai_analysis_usecase
from app.delivery.http.dto.ai_analysis_dto import AIAnalysisDTO
from app.usecase.ai_analysis_usecase import AIAnalysisUseCase

router = APIRouter(tags=["ai-analysis"])


@router.post(
    "/stocks/{symbol}/ai-analysis",
    response_model=AIAnalysisDTO,
    status_code=201,
)
async def create_ai_analysis(
    symbol: str,
    uc: AIAnalysisUseCase = Depends(provide_ai_analysis_usecase),
) -> AIAnalysisDTO:
    """Claude 심층 분석을 새로 요청하여 DB 에 저장."""

    try:
        entity = await uc.generate(symbol)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"analysis failed: {exc}")
    return AIAnalysisDTO.from_entity(entity)


@router.get(
    "/stocks/{symbol}/ai-analysis/history",
    response_model=list[AIAnalysisDTO],
)
async def list_ai_analysis_history(
    symbol: str,
    limit: int = Query(20, ge=1, le=100),
    uc: AIAnalysisUseCase = Depends(provide_ai_analysis_usecase),
) -> list[AIAnalysisDTO]:
    """해당 종목의 저장된 AI 분석 이력."""

    entities = await uc.list_history(symbol, limit)
    return [AIAnalysisDTO.from_entity(e) for e in entities]


@router.delete("/ai-analysis/{analysis_id}", status_code=204)
async def delete_ai_analysis(
    analysis_id: str,
    uc: AIAnalysisUseCase = Depends(provide_ai_analysis_usecase),
) -> None:
    ok = await uc.delete(analysis_id)
    if not ok:
        raise HTTPException(status_code=404, detail="analysis not found")
