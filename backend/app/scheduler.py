"""FastAPI 백그라운드 스케줄러.

서버 라이프사이클에 연결되어 주기적으로 실행되는 태스크들을 관리한다.

현재 스케줄된 작업:
- ``refresh_stock_master``: 서버 기동 직후 1회 + 이후 24시간 주기로
  KRX 공식 corpList 엔드포인트에서 전체 상장 종목 목록을 다운로드하여
  ``data/stock_master.json`` 파일에 저장.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Awaitable, Callable

from app.infrastructure.krx.corp_list_client import KrxCorpListClient
from app.infrastructure.stock.stock_repository_impl import STOCK_MASTER_PATH

logger = logging.getLogger(__name__)


DAY_SECONDS = 24 * 60 * 60


async def refresh_stock_master(cache_path: Path = STOCK_MASTER_PATH) -> int:
    """KRX 상장 종목 목록을 강제 갱신하여 JSON 파일로 저장.

    Returns:
        다운로드된 종목 수.
    """

    client = KrxCorpListClient(cache_path=cache_path)
    try:
        stocks = await client.fetch_all(force_refresh=True)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stock master refresh failed: %s", exc)
        return 0

    logger.info(
        "✅ stock master refreshed: %d stocks saved to %s",
        len(stocks),
        cache_path,
    )
    return len(stocks)


async def _periodic_task(
    name: str,
    job: Callable[[], Awaitable[None]],
    interval_seconds: float,
    run_on_start: bool = True,
) -> None:
    """간단한 주기 실행 루프.

    첫 실행 실패해도 다음 주기에는 재시도한다. asyncio.CancelledError 를
    존중하여 서버 종료 시 깔끔히 취소된다.
    """

    if run_on_start:
        try:
            logger.info("scheduler[%s]: running initial job", name)
            await job()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("scheduler[%s] initial run failed: %s", name, exc)

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            logger.info("scheduler[%s]: running scheduled job", name)
            await job()
        except asyncio.CancelledError:
            logger.info("scheduler[%s]: cancelled", name)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("scheduler[%s] job failed: %s", name, exc)


class BackgroundScheduler:
    """asyncio task 기반 경량 스케줄러."""

    def __init__(self) -> None:
        self._tasks: list[asyncio.Task] = []

    def start(self) -> None:
        """등록된 모든 주기 작업을 백그라운드 태스크로 실행."""

        if self._tasks:
            logger.warning("scheduler already started")
            return

        async def refresh_job() -> None:
            await refresh_stock_master()

        task = asyncio.create_task(
            _periodic_task(
                name="refresh_stock_master",
                job=refresh_job,
                interval_seconds=DAY_SECONDS,
                run_on_start=True,
            ),
            name="refresh_stock_master",
        )
        self._tasks.append(task)
        logger.info("✅ background scheduler started (%d tasks)", len(self._tasks))

    async def stop(self) -> None:
        """등록된 모든 태스크 취소 및 정리."""

        for task in self._tasks:
            if not task.done():
                task.cancel()
        for task in self._tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        self._tasks.clear()
        logger.info("background scheduler stopped")


scheduler = BackgroundScheduler()
