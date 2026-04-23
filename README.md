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

추가로 필요한 외부 계정/키 (자세한 발급 방법은 §3, §4 참조):

- **DART API Key** (필수): 상장사 공시 조회용
- **Claude Code 구독** (권장): AI 시그널/브리핑/뉴스 센티먼트/레벨 해설 기능

---

## 2. 소스 가져오기

```bash
git clone git@github.com:jikime/starnion-stock.git
# HTTPS: git clone https://github.com/jikime/starnion-stock.git
cd starnion-stock
```

프로젝트 구조:

```
starnion-stock/
├── backend/      # FastAPI API 서버 (port 8000)
│   ├── app/
│   ├── data/     # stock_master.json, trades.db (자동 생성)
│   └── pyproject.toml
└── frontend/     # Next.js UI (port 5555)
    └── package.json
```

---

## 3. DART OpenAPI 키 발급

공시 조회(종목별 공시, 시장 공시 피드)에 사용합니다. **무료이며 발급 즉시 사용 가능**합니다.

### 3.1 가입 및 키 발급

인증키 신청/관리 페이지: <https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do>

### 3.2 `.env` 에 등록

발급받은 키는 §5에서 생성하는 `backend/.env` 의 `DART_API_KEY` 에 넣습니다.

---

## 4. Claude Code 구독 연동

본 프로젝트의 LLM 호출은 **Anthropic API 키를 사용하지 않고** `claude-agent-sdk` → 번들된 `claude` CLI subprocess → 로컬 로그인 세션(Claude Code 구독) 순으로 위임됩니다. API 과금 없이 구독 할당량(Max plan 등)을 그대로 사용할 수 있습니다.

### 4.1 Claude Code 구독 가입

1. <https://claude.ai/upgrade> → **Pro** 또는 **Max** 플랜 구독
   - Free 플랜은 Claude Code 비대화형 사용 제한이 크므로 Pro 이상 권장
2. 결제 완료 후 <https://claude.ai> 에서 로그인 유지

### 4.2 로컬 Claude Code CLI 로그인

본 프로젝트 `uv sync` 시 `claude-agent-sdk` 패키지가 **번들 CLI**를 함께 설치합니다:

```
backend/.venv/lib/python3.13/site-packages/claude_agent_sdk/_bundled/claude
```

이 번들 CLI는 **호스트의 Claude Code 로그인 세션**(`~/.claude/`)을 공유합니다. 따라서 로그인 방법은 두 가지:

#### 방법 A — 호스트에 Claude Code 설치 후 로그인 (권장, 로컬/개발)

1. Claude Code 설치: <https://docs.claude.com/en/docs/claude-code/setup>
   ```bash
   # macOS/Linux
   curl -fsSL https://claude.ai/install.sh | bash
   ```
2. 브라우저 로그인:
   ```bash
   claude login
   # 또는 최초 실행 시 자동으로 브라우저가 열림
   claude
   ```
3. 로그인 성공 후 `~/.claude/` 하위에 세션 정보가 저장됨. 이 상태면 `.env` 에 `CLAUDE_CODE_OAUTH_TOKEN` 설정이 **불필요**합니다.

#### 방법 B — 장기 OAuth 토큰 (서버/CI, 방법 A 불가 시)

헤드리스 서버처럼 브라우저가 없는 환경에서는 토큰을 환경변수로 주입합니다.

1. 브라우저 가능한 로컬 머신에서 한 번 발급:
   ```bash
   claude setup-token
   # 브라우저 인증 후 콘솔에 sk-ant-oat01-... 형식의 토큰이 출력됨
   ```
2. 출력된 토큰을 **서버의** `backend/.env` 에 등록:
   ```bash
   echo 'CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-xxxxxxxxxx...' >> .env
   ```
3. 이 토큰은 1년간 유효하며, 구독이 유지되는 한 갱신 없이 사용 가능.

> ⚠️ OAuth 토큰은 구독 계정 전체에 접근할 수 있는 장기 자격증명입니다. `.env` 를 절대 커밋하지 말고, 서버에는 파일 권한 `chmod 600 .env` 을 적용하세요.

### 4.3 AI 기능 없이 실행하기

구독이 없거나 테스트용으로만 띄우고 싶다면 `CLAUDE_CODE_OAUTH_TOKEN` 을 비워두면 됩니다. AI 호출 실패는 내부에서 처리되어 알고리즘 기반 지표/레벨/공시만 표시됩니다.

---

## 5. Backend 설치 및 실행

```bash
cd backend

# 5.1 의존성 설치 (가상환경은 uv가 자동 생성)
uv sync

# 5.2 환경변수 파일 생성 (§3, §4에서 발급한 키 사용)
cp .env.example .env
chmod 600 .env         # 토큰 보호
# 편집기로 DART_API_KEY, (선택) CLAUDE_CODE_OAUTH_TOKEN 값 입력
```

환경변수 설명:

| 키 | 필수 | 설명 |
| --- | --- | --- |
| `DART_API_KEY` | ✅ | OpenDART API 키 (§3) |
| `CLAUDE_CODE_OAUTH_TOKEN` | 조건부 | Claude Code CLI 방법 A 사용 시 불필요, 방법 B 사용 시 필수 (§4) |
| `PORT` | ❌ | 서버 포트 (기본 8000) |
| `CORS_ORIGINS` | ❌ | 프론트엔드 origin (쉼표 구분, 기본 `http://localhost:3000`) |
| `DB_PATH` | ❌ | SQLite 경로 (기본 `data/trades.db`) |

### 실행

```bash
# 개발 모드 (hot reload)
uv run uvicorn app.main:app --reload --port 8000

# 운영 모드 (멀티 워커)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

첫 기동 시 `data/stock_master.json` 이 자동 생성되며, 24시간 주기로 스케줄러가 갱신합니다.

---

## 6. Frontend 설치

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

## 7. 빠른 시작 (요약)

터미널 2개:

```bash
# 터미널 1 — Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# 터미널 2 — Frontend
cd frontend && pnpm install && pnpm dev
```

브라우저: <http://localhost:5555>

---

## 라이선스

Private. 무단 복제/배포 금지.
