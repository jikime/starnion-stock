from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.domain.entity.price_level import PriceLevel, PriceLevelsSnapshot


class PriceLevelDTO(BaseModel):
    price: float
    kind: str              # "support" | "resistance"
    touch_count: int
    strength: int
    explanation: str

    @classmethod
    def from_entity(cls, entity: PriceLevel) -> "PriceLevelDTO":
        return cls(
            price=entity.price,
            kind=entity.kind,
            touch_count=entity.touch_count,
            strength=entity.strength,
            explanation=entity.explanation,
        )


class PriceLevelsSnapshotDTO(BaseModel):
    symbol: str
    current_price: float
    levels: list[PriceLevelDTO]
    computed_at: datetime

    @classmethod
    def from_entity(
        cls, entity: PriceLevelsSnapshot
    ) -> "PriceLevelsSnapshotDTO":
        return cls(
            symbol=entity.symbol,
            current_price=entity.current_price,
            levels=[PriceLevelDTO.from_entity(lv) for lv in entity.levels],
            computed_at=entity.computed_at,
        )
