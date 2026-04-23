from dataclasses import dataclass


@dataclass
class Disclosure:
    rcept_no: str
    corp_code: str
    corp_name: str
    report_nm: str
    rcept_dt: str  # "YYYYMMDD"
    category: str  # "배당" | "유증" | "자사주" | "정기" | "공시"
    summary: str = ""
    url: str = ""


@dataclass
class DividendInfo:
    symbol: str
    year: int
    quarter: int
    dividend_per_share: float | None = None
    dividend_yield: float | None = None
    dividend_total: float | None = None
    payout_ratio: float | None = None
