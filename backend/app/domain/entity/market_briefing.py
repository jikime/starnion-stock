"""AI 시장 일일 브리핑 엔티티 — ``docs/11`` 니온 AI 비서 출력."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class MarketBriefing:
    date: str                          # YYYY-MM-DD (1일 1회 캐시 키)
    headline: str                      # 한 줄 요약
    weather: str                       # "맑음" | "흐림" | "비"
    briefing: str                      # 3~4문장 본문
    sectors_strong: list[str] = field(default_factory=list)
    sectors_weak: list[str] = field(default_factory=list)
    computed_at: datetime | None = None
