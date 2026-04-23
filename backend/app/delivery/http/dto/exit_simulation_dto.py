from __future__ import annotations

from pydantic import BaseModel

from app.domain.entity.exit_simulation import (
    ExitSignal,
    ExitSimulation,
    MasterExitOpinion,
)


class ExitSignalDTO(BaseModel):
    name: str
    label: str
    triggered: bool
    detail: str

    @classmethod
    def from_entity(cls, e: ExitSignal) -> "ExitSignalDTO":
        return cls(
            name=e.name, label=e.label, triggered=e.triggered, detail=e.detail
        )


class MasterExitOpinionDTO(BaseModel):
    name: str
    label: str
    decision: str
    reason: str

    @classmethod
    def from_entity(cls, e: MasterExitOpinion) -> "MasterExitOpinionDTO":
        return cls(
            name=e.name, label=e.label, decision=e.decision, reason=e.reason
        )


class ExitSimulationDTO(BaseModel):
    symbol: str
    entry_price: float
    current_price: float
    pnl: float
    pnl_pct: float
    urgency_score: int
    recommendation: str
    signals: list[ExitSignalDTO]
    master_opinions: list[MasterExitOpinionDTO]

    @classmethod
    def from_entity(cls, e: ExitSimulation) -> "ExitSimulationDTO":
        return cls(
            symbol=e.symbol,
            entry_price=e.entry_price,
            current_price=e.current_price,
            pnl=e.pnl,
            pnl_pct=e.pnl_pct,
            urgency_score=e.urgency_score,
            recommendation=e.recommendation,
            signals=[ExitSignalDTO.from_entity(s) for s in e.signals],
            master_opinions=[
                MasterExitOpinionDTO.from_entity(o) for o in e.master_opinions
            ],
        )
