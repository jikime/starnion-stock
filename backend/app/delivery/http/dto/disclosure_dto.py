from __future__ import annotations

from pydantic import BaseModel

from app.domain.entity.disclosure import Disclosure, DividendInfo


class DisclosureDTO(BaseModel):
    rcept_no: str
    corp_code: str
    corp_name: str
    report_nm: str
    rcept_dt: str
    category: str
    summary: str = ""
    url: str = ""

    @classmethod
    def from_entity(cls, entity: Disclosure) -> "DisclosureDTO":
        return cls(
            rcept_no=entity.rcept_no,
            corp_code=entity.corp_code,
            corp_name=entity.corp_name,
            report_nm=entity.report_nm,
            rcept_dt=entity.rcept_dt,
            category=entity.category,
            summary=entity.summary,
            url=entity.url,
        )


class DividendInfoDTO(BaseModel):
    symbol: str
    year: int
    quarter: int
    dividend_per_share: float | None = None
    dividend_yield: float | None = None
    dividend_total: float | None = None
    payout_ratio: float | None = None

    @classmethod
    def from_entity(cls, entity: DividendInfo) -> "DividendInfoDTO":
        return cls(
            symbol=entity.symbol,
            year=entity.year,
            quarter=entity.quarter,
            dividend_per_share=entity.dividend_per_share,
            dividend_yield=entity.dividend_yield,
            dividend_total=entity.dividend_total,
            payout_ratio=entity.payout_ratio,
        )
