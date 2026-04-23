import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.delivery.http.router import create_api_router
from app.infrastructure.persistence.database import init_db
from app.scheduler import scheduler

# app.* 모듈 로거를 uvicorn 로그와 함께 콘솔로 노출
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("app").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # 백그라운드 스케줄러 시작:
    # - 기동 직후 KRX 종목 마스터 JSON 생성
    # - 이후 24시간 주기로 자동 갱신
    scheduler.start()
    try:
        yield
    finally:
        await scheduler.stop()


app = FastAPI(
    title="Stock War Room API",
    description="Korean stock trading war room — real-time market data, news sentiment, DART disclosures, and AI signals.",
    version="0.1.0",
    lifespan=lifespan,
)

# B3: Gzip 압축 (500B 초과 응답 — 대부분 JSON 응답 커버)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(create_api_router())


@app.get("/")
async def root():
    return {"service": "Stock War Room API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
