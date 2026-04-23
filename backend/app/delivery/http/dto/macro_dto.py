from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.macro import MacroIndicator, MacroSnapshot


class MacroIndicatorDTO(BaseModel):
    code: str
    label: str
    value: float
    change: float
    change_pct: float

    @classmethod
    def from_entity(cls, entity: MacroIndicator) -> "MacroIndicatorDTO":
        return cls(
            code=entity.code,
            label=entity.label,
            value=entity.value,
            change=entity.change,
            change_pct=entity.change_pct,
        )


class MacroSnapshotDTO(BaseModel):
    indicators: list[MacroIndicatorDTO]
    risk_level: str
    risk_summary: str
    fetched_at: datetime

    @classmethod
    def from_entity(cls, entity: MacroSnapshot) -> "MacroSnapshotDTO":
        return cls(
            indicators=[
                MacroIndicatorDTO.from_entity(i) for i in entity.indicators
            ],
            risk_level=entity.risk_level,
            risk_summary=entity.risk_summary,
            fetched_at=entity.fetched_at,
        )
