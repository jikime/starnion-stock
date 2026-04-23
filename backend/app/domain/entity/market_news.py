"""시장 메인 뉴스 엔티티 (종목 무관 — 대시보드용)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class MarketNewsItem:
    id: str                          # md5(headline)
    headline: str
    url: str
    summary: str = ""                # 본문 첫 줄 요약 (옵션)
    press: str = ""                  # 언론사명
    image_url: str = ""              # 썸네일 (네이버 thumb70)
    published_at: datetime | None = None
