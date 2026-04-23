"""업종 등락률 유즈케이스 — 네이버 크롤링 + 5분 in-memory 캐시."""

from __future__ import annotations

import time
from dataclasses import dataclass

from app.domain.entity.sector import SectorRank
from app.infrastructure.naver.sector_client import NaverSectorClient


CACHE_TTL = 300  # 5분


@dataclass
class _Cache:
    at: float = 0.0
    data: list[SectorRank] | None = None


class SectorUseCase:
    def __init__(self, client: NaverSectorClient) -> None:
        self.client = client
        self._cache = _Cache()

    async def get_sectors(self) -> list[SectorRank]:
        now = time.monotonic()
        if self._cache.data and (now - self._cache.at) < CACHE_TTL:
            return self._cache.data
        data = await self.client.get_sectors()
        self._cache = _Cache(at=now, data=data)
        return data
