# API 분석

## 요약
- 총 엔드포인트: **0개** (API route 없음)
- 프로토콜: **없음** (순수 프론트엔드 전용 프로젝트)
- 인증: **없음**
- 문서화: **없음**
- 외부 API 호출: **없음** (fetch, axios, SWR, React Query 등 미사용)
- 실시간 통신: **없음** (WebSocket, SSE, polling 미사용)
- 데이터 소스: **100% 클라이언트 사이드 Mock 데이터** (하드코딩 + 랜덤 생성)

## 현재 상태: v0.app 생성 프론트엔드 프로토타입

이 프로젝트는 v0.app에서 생성된 **순수 UI 프로토타입**으로, 백엔드 연동이 전혀 없는 상태이다. `layout.tsx`의 metadata에 `generator: 'v0.app'`이 명시되어 있으며, 모든 데이터가 컴포넌트 내부에 하드코딩되어 있다.

### 확인된 사실
| 항목 | 결과 |
|------|------|
| `app/api/` 디렉토리 | 존재하지 않음 |
| `route.ts` / `route.tsx` 파일 | 0개 |
| `fetch()` 호출 (소스 코드) | 0건 |
| `axios` 사용 | 0건 (package.json에도 미포함) |
| `useSWR` / `useQuery` / React Query | 0건 (미설치) |
| WebSocket / SSE | 0건 |
| `.env` / 환경 변수 파일 | 존재하지 않음 |
| `process.env` 참조 (소스 코드) | 0건 |
| `next.config.mjs` 프록시/리다이렉트 | 미설정 |
| Zod 스키마 사용 (소스 코드) | 0건 (package.json에 설치만 되어 있음) |

## 엔드포인트 분포

| Method | 수 |
|--------|---|
| GET | 0 |
| POST | 0 |
| PUT/PATCH | 0 |
| DELETE | 0 |

> Next.js App Router의 `app/api/` 디렉토리가 존재하지 않으며, `route.ts` 파일이 프로젝트 전체에 0개이다.

## Mock 데이터 인벤토리

API가 없는 대신, 모든 데이터가 컴포넌트 내부에 하드코딩되어 있다. 향후 백엔드 연동 시 교체가 필요한 Mock 데이터 목록:

| 파일 | Mock 데이터 | 데이터 유형 | 예상 API 대체 |
|------|------------|------------|--------------|
| `components/war-room/stock-context.tsx` | `STOCK_LIST` (20개 종목) | 종목 마스터 + 현재가 | `GET /api/stocks`, `GET /api/stocks/{symbol}/price` |
| `components/war-room/ai-chart.tsx` | `generateCandles()` (48개 캔들) | OHLCV 차트 데이터 | `GET /api/stocks/{symbol}/candles` |
| `components/war-room/ai-chart.tsx` | `computeRSI/SMA/Bollinger/MACD` | 기술적 지표 | `GET /api/stocks/{symbol}/indicators` |
| `components/war-room/ai-chart.tsx` | `NEWS_EVENTS` (5건) | 차트 위 뉴스 이벤트 | `GET /api/stocks/{symbol}/news-events` |
| `components/war-room/ai-chart.tsx` | `SIGNAL_NEWS` | AI 매수 신호 뉴스 | `GET /api/stocks/{symbol}/signals` |
| `components/war-room/intelligence-sidebar.tsx` | `NEWS_ITEMS` (7건) | AI 뉴스 피드 | `GET /api/stocks/{symbol}/news` |
| `components/war-room/intelligence-sidebar.tsx` | `KEYWORDS` (12개) | 트렌딩 키워드 클라우드 | `GET /api/keywords/trending` |
| `components/war-room/intelligence-sidebar.tsx` | `DART_ITEMS` (3건) | DART 공시 피드 | `GET /api/stocks/{symbol}/disclosures` |
| `components/war-room/intelligence-sidebar.tsx` | `buildHeatmap()` | 24h 센티먼트 히트맵 | `GET /api/stocks/{symbol}/sentiment` |
| `components/war-room/intelligence-sidebar.tsx` | `momentumScore: 74` | 모멘텀 스코어 | `GET /api/stocks/{symbol}/momentum` |
| `components/war-room/technical-scorecard.tsx` | `RSI_VALUE, MACD_VALUE, ...` (8개 상수) | 오실레이터 값 | `GET /api/stocks/{symbol}/oscillators` |
| `components/war-room/ticker-bar.tsx` | `INITIAL_TICKERS` (12개) | 시장 지수 + 주요 종목 시세 | `GET /api/market/tickers` |
| `components/war-room/trade-log.tsx` | `TRADE_LOG` (4건) | 매매 기록 | `GET /api/trades`, `POST /api/trades` |
| `components/war-room/ai-briefing-toast.tsx` | `BRIEFINGS` (3건) | AI 브리핑 알림 | WebSocket `ai:briefing` 이벤트 |
| `components/war-room/ai-scanner.tsx` | `STEPS` (4단계) | AI 스캐너 진행 상태 | WebSocket `scan:progress` 이벤트 |
| `components/war-room/stock-search.tsx` | `STOCK_LIST` (context 재사용) | 종목 검색 | `GET /api/stocks/search?q={query}` |

## WebSocket / 실시간

현재 WebSocket, SSE, polling 등 실시간 통신은 **전혀 사용되지 않고 있다**.

다만 UI에서 실시간 데이터를 **시뮬레이션**하는 패턴이 존재한다:

| 컴포넌트 | 시뮬레이션 방식 | 향후 실시간 연동 대상 |
|---------|---------------|-------------------|
| `ticker-bar.tsx` | CSS 애니메이션으로 시세 스크롤 + `setInterval`로 시계 갱신 | WebSocket 시세 스트림 |
| `ai-briefing-toast.tsx` | `setTimeout`으로 3건의 브리핑을 순차 표시 (2.5s, 9s, 17s) | WebSocket AI 브리핑 이벤트 |
| `ai-scanner.tsx` | `setTimeout` 체이닝으로 4단계 스캔 애니메이션 | WebSocket 스캔 진행 이벤트 |
| `intelligence-sidebar.tsx` | "실시간" 라벨 표시, 실제 데이터는 정적 | WebSocket 뉴스 스트림 |
| `technical-scorecard.tsx` | "실시간" 라벨 표시, 실제 값은 하드코딩 상수 | WebSocket 지표 스트림 |

## 인증/인가

- 방식: **없음**
- 토큰 위치: 해당 없음
- 권한 모델: 해당 없음
- 미들웨어 체인: 해당 없음

> 프로젝트에 인증 관련 코드가 전혀 없다. NextAuth, Clerk, Supabase Auth 등 인증 라이브러리도 설치되어 있지 않다.

## 요청/응답 계약

- 입력 검증: **해당 없음** (API 미존재)
  - Zod가 `package.json`에 설치되어 있지만, 소스 코드에서 import하는 곳이 0건 (v0.app이 기본 설치한 것으로 추정)
  - `react-hook-form` + `@hookform/resolvers`도 설치만 되어 있고 미사용
- 응답 포맷: 해당 없음
- 에러 응답 구조: 해당 없음
- 상태 코드 사용: 해당 없음

## 데이터 페칭 패턴

현재 사용 중인 데이터 관리 패턴:

| 패턴 | 사용 여부 | 설명 |
|------|----------|------|
| React Context | **사용** | `StockProvider` — 선택된 종목 상태 공유 |
| `useState` / `useEffect` | **사용** | 모든 컴포넌트에서 로컬 UI 상태 관리 |
| `useMemo` / `useCallback` | **부분 사용** | `ai-chart.tsx`에서 메모이제이션 |
| SWR | 미사용 | 미설치 |
| React Query / TanStack Query | 미사용 | 미설치 |
| Redux / Zustand | 미사용 | 미설치 |
| Server Components 데이터 페칭 | 미사용 | 모든 컴포넌트가 `'use client'` |

## RESTful 준수도

해당 없음. API가 존재하지 않는다.

## 강점

1. **UI 완성도가 높다** — 차트, 스코어카드, 뉴스 피드, 히트맵 등 복잡한 대시보드 UI가 완전히 구현되어 있다
2. **Mock 데이터가 현실적이다** — 실제 한국 주식 종목명, 가격대, 뉴스 헤드라인이 사용되어 바로 API 연동 시 데이터 구조 참고가 가능하다
3. **데이터 구조가 명확하다** — TypeScript 인터페이스(`Stock`, `NewsItem`, `TradeEntry`, `BriefingMessage` 등)가 잘 정의되어 있어, 이를 기반으로 API 계약(contract)을 설계할 수 있다
4. **실시간 시뮬레이션이 적절하다** — setTimeout/setInterval 기반 시뮬레이션이 향후 WebSocket으로 교체할 지점을 명확히 보여준다
5. **AI 타점 로직이 프론트엔드에 프로토타입 되어 있다** — RSI, 이평선, 볼린저밴드, MACD 계산이 클라이언트에 구현되어 있어 백엔드 API 설계의 참고가 된다

## 개선점

1. **백엔드 API 연동 필수** — 현재 100% Mock 데이터이므로, PRD에 명시된 Python/FastAPI 백엔드 연결이 가장 시급하다
2. **API 클라이언트 레이어 부재** — fetch wrapper, API 클라이언트 모듈, 에러 핸들링 유틸 등이 전혀 없다. `lib/api.ts` 같은 중앙 집중 API 레이어 구축이 필요하다
3. **서버 컴포넌트 미활용** — 모든 컴포넌트가 `'use client'`로 선언되어 있어, 초기 데이터 로딩을 Server Component에서 수행하는 Next.js 패턴을 활용하지 못하고 있다
4. **데이터 페칭 라이브러리 미사용** — SWR이나 React Query 없이 API 연동 시 캐싱, 재시도, 낙관적 업데이트 등을 직접 구현해야 한다
5. **환경 변수 설정 부재** — `.env` 파일이 없고, API Base URL 등 설정 변수가 전혀 정의되어 있지 않다
6. **인증 체계 부재** — 사용자 인증, 세션 관리, API 키 관리 등이 전혀 없다
7. **Zod 미활용** — 설치만 되어 있고 실제 사용이 없다. API 응답 검증에 활용할 수 있다
8. **기술적 지표 계산의 서버 이전 필요** — RSI, MACD, 볼린저밴드 등의 계산이 클라이언트에서 이루어지고 있으나, 대량 데이터 처리를 위해 백엔드로 이전해야 한다
9. **Rate limiting / CORS 설정 부재** — 백엔드가 없으므로 해당 설정도 부재. 향후 FastAPI 백엔드 구축 시 설정 필요
10. **실시간 데이터 아키텍처 미결정** — 시세, 뉴스, AI 신호 등 실시간 데이터의 전달 방식(WebSocket vs SSE vs polling)이 결정되지 않았다

## PRD 대비 API 갭 분석

PRD에서 요구하는 백엔드 기능과 현재 상태의 차이:

| PRD 요구사항 | 현재 상태 | 갭 |
|-------------|----------|---|
| 네이버 금융 크롤링 | Mock 데이터 하드코딩 | 백엔드 크롤러 구현 필요 |
| AI 타점 분석 (FastAPI) | 클라이언트 사이드 계산 | 서버 사이드 AI 엔진 구현 필요 |
| 실시간 시세 스트림 | CSS 애니메이션 시뮬레이션 | WebSocket/SSE 연동 필요 |
| 뉴스 센티먼트 분석 | 하드코딩된 센티먼트 값 | NLP 백엔드 서비스 필요 |
| 매매 기록 저장 | 메모리 내 상수 배열 | DB + CRUD API 필요 |
| DART 공시 알림 | 하드코딩 3건 | DART OpenAPI 연동 필요 |

## 향후 필요한 API 설계 (추정)

현재 Mock 데이터 구조를 바탕으로 추정한 필요 API 목록:

| Method | Path (추정) | 용도 | 우선순위 |
|--------|------------|------|---------|
| GET | `/api/stocks` | 종목 마스터 목록 | 높음 |
| GET | `/api/stocks/search` | 종목 검색 (이름/코드/섹터) | 높음 |
| GET | `/api/stocks/{symbol}/price` | 현재가 조회 | 높음 |
| GET | `/api/stocks/{symbol}/candles` | OHLCV 캔들 데이터 | 높음 |
| GET | `/api/stocks/{symbol}/indicators` | 기술적 지표 (RSI, MACD 등) | 높음 |
| GET | `/api/stocks/{symbol}/signals` | AI 매수/매도 신호 | 높음 |
| GET | `/api/stocks/{symbol}/news` | 종목 관련 뉴스 + 센티먼트 | 중간 |
| GET | `/api/stocks/{symbol}/sentiment` | 24h 센티먼트 히트맵 | 중간 |
| GET | `/api/stocks/{symbol}/momentum` | 모멘텀 스코어 | 중간 |
| GET | `/api/stocks/{symbol}/disclosures` | DART 공시 목록 | 중간 |
| GET | `/api/market/tickers` | 시장 지수 + 주요 종목 시세 | 높음 |
| GET | `/api/keywords/trending` | 트렌딩 키워드 | 낮음 |
| GET | `/api/trades` | 매매 기록 조회 | 중간 |
| POST | `/api/trades` | 매매 기록 등록 | 중간 |
| PUT | `/api/trades/{id}` | 매매 기록 수정 | 낮음 |
| DELETE | `/api/trades/{id}` | 매매 기록 삭제 | 낮음 |
| WS | `/ws/tickers` | 실시간 시세 스트림 | 높음 |
| WS | `/ws/signals` | AI 신호 실시간 알림 | 높음 |
| WS | `/ws/news` | 실시간 뉴스 스트림 | 중간 |
