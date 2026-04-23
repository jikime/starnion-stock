from __future__ import annotations

from pydantic import BaseModel

from app.domain.entity.sector import SectorRank


class SectorRankDTO(BaseModel):
    name: str
    change_pct: float
    total_count: int
    up_count: int
    down_count: int
    flat_count: int

    @classmethod
    def from_entity(cls, e: SectorRank) -> "SectorRankDTO":
        return cls(
            name=e.name,
            change_pct=e.change_pct,
            total_count=e.total_count,
            up_count=e.up_count,
            down_count=e.down_count,
            flat_count=e.flat_count,
        )
