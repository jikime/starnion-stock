"""PriceLevel 캐시 repository Protocol."""

from __future__ import annotations

from typing import Protocol

from app.domain.entity.price_level import PriceLevelsSnapshot


class PriceLevelRepository(Protocol):
    async def get_latest(self, symbol: str) -> PriceLevelsSnapshot | None:
        """해당 종목의 가장 최신 캐시 스냅샷 반환 (TTL 체크는 호출자 책임)."""
        ...

    async def save(self, snapshot: PriceLevelsSnapshot) -> None:
        """새 스냅샷 저장. 이전 캐시는 덮어쓰기 (종목당 최신 1개만 유지)."""
        ...
