from typing import Protocol

from app.domain.entity.disclosure import Disclosure, DividendInfo


class DisclosureRepository(Protocol):
    async def list_recent(self, symbol: str, days: int = 30) -> list[Disclosure]: ...
    async def get_dividends(
        self, symbol: str, year: int | None = None
    ) -> list[DividendInfo]: ...
    async def list_all_recent(
        self, days: int = 1, limit: int = 30
    ) -> list[Disclosure]: ...
