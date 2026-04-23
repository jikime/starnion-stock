# Stock War Room

한국 주식 트레이딩 워룸 — 실시간 시세, 뉴스 센티먼트, DART 공시, AI 시그널 대시보드.

- **Backend**: FastAPI + Clean Architecture (Python 3.11–3.13, [uv](https://github.com/astral-sh/uv))
- **Frontend**: Next.js 15 + shadcn/ui + TanStack Query (Node.js, [pnpm](https://pnpm.io))
- **Data**: pandas / finance-datareader / dart-fss / 네이버 금융 크롤링
- **LLM**: Claude Agent SDK (Claude Code CLI 구독 기반)

---

## 1. 요구사항

| 항목 | 버전 |
| --- | --- |
| Python | 3.11 – 3.13 (3.13 권장) |
| Node.js | 20 LTS 이상 |
| pnpm | 9 이상 |
| uv | 최신 (`curl -LsSf https://astral.sh/uv/install.sh \| sh`) |
| Git | 2.30 이상 |
| OS | macOS / Linux (Windows는 WSL2 권장) |

추가로 필요한 외부 계정/키:

- **DART API Key**: <https://opendart.fss.or.kr> 에서 발급 (무료)
- **Claude Code 구독** (선택): AI 시그널/브리핑 기능 사용 시

---

## 2. 소스 가져오기

```bash
git clone git@github.com:jikime/stock-war-room.git
cd stock-war-room
```

프로젝트 구조:

```
stock-war-room/
├── backend/      # FastAPI API 서버 (port 8000)
│   ├── app/
│   ├── data/     # stock_master.json, trades.db (자동 생성)
│   └── pyproject.toml
└── frontend/     # Next.js UI (port 5555)
    └── package.json
```

---

## 3. Backend 설치

```bash
cd backend

# 의존성 설치 (가상환경은 uv가 자동 생성)
uv sync

# 환경변수 파일 생성
cat > .env <<'EOF'
DART_API_KEY=your_dart_api_key_here
CLAUDE_CODE_OAUTH_TOKEN=                 # 선택: Claude Code 구독 토큰
PORT=8000
CORS_ORIGINS=http://localhost:5555
DB_PATH=data/trades.db
EOF
```

환경변수 설명:

| 키 | 필수 | 설명 |
| --- | --- | --- |
| `DART_API_KEY` | ✅ | OpenDART API 키 |
| `CLAUDE_CODE_OAUTH_TOKEN` | ❌ | Claude Agent SDK 인증 토큰 (없으면 AI 기능 비활성) |
| `PORT` | ❌ | 서버 포트 (기본 8000) |
| `CORS_ORIGINS` | ❌ | 프론트엔드 origin (쉼표 구분) |
| `DB_PATH` | ❌ | SQLite 경로 (기본 `data/trades.db`) |

### Backend 실행

```bash
# 개발 모드 (hot reload)
uv run uvicorn app.main:app --reload --port 8000

# 운영 모드 (멀티 워커)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

첫 기동 시 `data/stock_master.json` 이 자동 생성되며, 24시간 주기로 스케줄러가 갱신합니다.

API 문서: <http://localhost:8000/docs>

---

## 4. Frontend 설치

```bash
cd ../frontend
pnpm install
```

`frontend/next.config.mjs` 가 `/api/*` 요청을 `http://localhost:8000` 으로 리라이트하므로, 동일 호스트 개발 시 별도 env는 불필요합니다.

다른 호스트의 백엔드를 가리키려면:

```bash
echo 'NEXT_PUBLIC_API_URL=https://api.example.com/api' > .env.local
```

### Frontend 실행

```bash
# 개발 모드
pnpm dev              # http://localhost:5555

# 운영 모드
pnpm build
pnpm start
```

---

## 5. 빠른 시작 (요약)

터미널 2개:

```bash
# 터미널 1 — Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# 터미널 2 — Frontend
cd frontend && pnpm install && pnpm dev
```

브라우저: <http://localhost:5555>

---

## 6. 배포 체크리스트

**공통**
- [ ] `backend/.env` 의 `DART_API_KEY` 설정
- [ ] `CORS_ORIGINS` 를 운영 도메인으로 변경
- [ ] `frontend/next.config.mjs` 의 rewrites 대상 또는 `NEXT_PUBLIC_API_URL` 를 운영 백엔드로 변경

**Backend (Linux 서버 예시)**
```bash
# systemd 단위 예시 — /etc/systemd/system/stock-war-room.service
[Service]
WorkingDirectory=/opt/stock-war-room/backend
ExecStart=/root/.local/bin/uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
EnvironmentFile=/opt/stock-war-room/backend/.env
```

**Frontend**
- `pnpm build` 후 `pnpm start` 또는 Vercel / Node 호환 플랫폼에 배포
- Next.js standalone output을 쓸 경우 `next.config.mjs` 에 `output: 'standalone'` 추가

**리버스 프록시 (Nginx 예시)**
```nginx
server {
    listen 443 ssl http2;
    server_name your.domain;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_set_header Host $host;
    }
}
```

---

## 7. 문제 해결

- `uv sync` 시 lxml wheel 에러 → `lxml>=5.3.0,<6.1` 로 제한됨 (Python 3.13 지원)
- `data/trades.db` 초기화 필요 시 → 파일 삭제 후 재기동 (lifespan에서 `init_db()` 자동 실행)
- `stock_master.json` 갱신 수동 트리거 → 서버 재기동 또는 스케줄러 24h 대기

---

## 라이선스

Private. 무단 복제/배포 금지.
