"""Disclosure 유즈케이스. DART 공시 검색 + 배당 정보."""

from __future__ import annotations

from app.domain.entity.disclosure import Disclosure, DividendInfo
from app.domain.repository.disclosure_repository import DisclosureRepository


class DisclosureUseCase:
    def __init__(self, disclosure_repo: DisclosureRepository) -> None:
        self.disclosure_repo = disclosure_repo

    async def list_recent(
        self, symbol: str, days: int = 30
    ) -> list[Disclosure]:
        return await self.disclosure_repo.list_recent(symbol, days)

    async def get_dividends(
        self, symbol: str, year: int | None = None
    ) -> list[DividendInfo]:
        return await self.disclosure_repo.get_dividends(symbol, year)

    async def list_all_recent(
        self, days: int = 1, limit: int = 30
    ) -> list[Disclosure]:
        """전 종목 최근 N일 공시 (대시보드용)."""

        return await self.disclosure_repo.list_all_recent(days=days, limit=limit)
