"""거시경제 스냅샷 유즈케이스 — 단순 패스스루."""

from __future__ import annotations

from app.domain.entity.macro import MacroSnapshot
from app.infrastructure.macro.macro_repository_impl import FdrMacroRepository


class MacroUseCase:
    def __init__(self, macro_repo: FdrMacroRepository) -> None:
        self.macro_repo = macro_repo

    async def get_snapshot(self) -> MacroSnapshot:
        return await self.macro_repo.get_snapshot()
