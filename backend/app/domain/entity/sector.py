"""업종(섹터) 등락률 엔티티."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SectorRank:
    """네이버 업종별 등락 요약."""

    name: str                  # 업종명 (e.g. "반도체")
    change_pct: float          # 평균 등락률 (%)
    total_count: int           # 전체 종목 수
    up_count: int              # 상승 종목 수
    down_count: int            # 하락 종목 수
    flat_count: int            # 보합 종목 수
