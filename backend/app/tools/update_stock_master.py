"""수동 실행용 종목 마스터 갱신 CLI.

Usage:
    uv run python -m app.tools.update_stock_master

cron 등 외부 스케줄러로 매일 1회 실행할 수도 있고, 서버 기동 전에
미리 생성해두는 용도로도 사용한다. FastAPI 서버 기동 시 자동 스케줄러가
있으므로 일반적으로는 수동 실행이 필요하지 않다.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from app.scheduler import refresh_stock_master


async def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    )
    count = await refresh_stock_master()
    if count == 0:
        print("❌ 종목 마스터 갱신 실패 (0 stocks)", file=sys.stderr)
        return 1
    print(f"✅ {count:,} 종목 저장 완료")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
