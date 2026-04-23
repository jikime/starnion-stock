# 아키텍처 분석

> 프로젝트: **StarNion: Stocks War Room**
> 분석일: 2026-04-15
> 프로젝트 경로: `/Users/jikime/Dev/Business/Projects/Stocks/stock-war-room`

---

## 기술 스택

| 영역 | 기술 | 버전 | 비고 |
|------|------|------|------|
| **Framework** | Next.js (App Router) | 16.2.0 | RSC 활성화, `components.json`에서 `rsc: true` |
| **UI Library** | React | 19.x | React 19 concurrent features 사용 가능 |
| **Language** | TypeScript | 5.7.3 | strict 모드, `ignoreBuildErrors: true` (next.config) |
| **Styling** | Tailwind CSS 4 | 4.2.0 | PostCSS 기반, `@tailwindcss/postcss` 플러그인 |
| **CSS Animation** | tw-animate-css | 1.3.3 | 커스텀 keyframes + tw-animate-css 병용 |
| **Component System** | shadcn/ui (new-york) | - | 57개 UI 컴포넌트 (Radix UI 기반) |
| **Charts** | Recharts | 2.15.0 | ComposedChart, RadialBarChart 등 활용 |
| **Icons** | lucide-react | 0.564.0 | 전체 아이콘 일관성 있게 사용 |
| **Form** | react-hook-form + zod | 7.54.1 / 3.24.1 | hookform/resolvers 포함 |
| **Theme** | next-themes | 0.4.6 | ThemeProvider 존재하나 현재 layout에서 미사용 |
| **Toast** | sonner + Radix Toast | 1.7.1 / 1.2.15 | 두 가지 토스트 시스템 병존 |
| **Panel** | react-resizable-panels | 2.1.7 | 리사이즈 가능 패널 라이브러리 |
| **패키지 관리자** | pnpm | - | pnpm-lock.yaml 존재 |
| **DB** | 없음 | - | 모든 데이터가 클라이언트 Mock 데이터 |
| **Backend / API** | 없음 | - | API Route 없음, 순수 프론트엔드 |
| **Infra** | Vercel (추정) | - | `@vercel/analytics` 의존성, `images.unoptimized: true` |

### PRD 대비 누락 기술

| PRD 명시 | 실제 설치 여부 | 상태 |
|----------|---------------|------|
| Framer Motion | package.json에 없음 | **누락** -- 애니메이션은 CSS keyframes로 대체 구현됨 |

---

## 디렉토리 구조

```
stock-war-room/
├── app/
│   ├── globals.css            # Tailwind 4 + 커스텀 CSS 변수 + 커스텀 애니메이션
│   ├── layout.tsx             # RootLayout (Inter + JetBrains Mono 폰트)
│   └── page.tsx               # 단일 페이지 -- War Room 대시보드 (SPA)
├── components/
│   ├── theme-provider.tsx     # next-themes 래퍼 (현재 미사용)
│   ├── ui/                    # shadcn/ui 컴포넌트 57개
│   │   ├── accordion.tsx ... tooltip.tsx
│   │   ├── use-mobile.tsx     # (hooks/ 중복)
│   │   └── use-toast.ts       # (hooks/ 중복)
│   └── war-room/              # 핵심 비즈니스 컴포넌트 9개
│       ├── stock-context.tsx   # 전역 종목 상태 (Context API)
│       ├── stock-search.tsx    # 종목 검색 (Cmd+K)
│       ├── ticker-bar.tsx      # 상단 실시간 시세 티커
│       ├── ai-chart.tsx        # 메인 캔들 차트 (볼린저, MA, MACD, Buy Signal)
│       ├── ai-scanner.tsx      # AI 스캔 오버레이 (레이더 애니메이션)
│       ├── intelligence-sidebar.tsx  # 우측 인텔리전스 패널
│       ├── technical-scorecard.tsx   # 하단 기술적 지표 스코어카드
│       ├── trade-log.tsx       # 트레이드 로그 / 전략 노트
│       └── ai-briefing-toast.tsx    # AI 브리핑 토스트 알림
├── hooks/
│   ├── use-mobile.ts          # 모바일 감지 훅
│   └── use-toast.ts           # 토스트 상태 관리 훅 (reducer 패턴)
├── lib/
│   └── utils.ts               # cn() 유틸리티 (clsx + tailwind-merge)
├── styles/
│   └── globals.css            # shadcn 기본 생성 CSS (미사용 -- app/globals.css가 실제 진입점)
├── public/                    # 아이콘, 플레이스홀더 이미지 9개
├── package.json               # pnpm 기반
├── tsconfig.json              # `@/*` 경로 별칭
├── next.config.mjs            # ignoreBuildErrors, unoptimized images
├── postcss.config.mjs         # @tailwindcss/postcss
└── components.json            # shadcn/ui 설정 (new-york 스타일, lucide 아이콘)
```

---

## 레이어 구조

### 단일 레이어 프론트엔드 (No Backend)

이 프로젝트는 **순수 프론트엔드 SPA**로, 백엔드/API/DB 레이어가 존재하지 않는다.

```
┌──────────────────────────────────────────────────────────┐
│  Presentation Layer (React Components)                   │
│  ┌────────────────────┐  ┌─────────────────────────────┐ │
│  │  app/page.tsx       │  │  app/layout.tsx              │ │
│  │  (War Room 단일 페이지)│  │  (RootLayout, 폰트, CSS)    │ │
│  └────────┬───────────┘  └─────────────────────────────┘ │
│           │                                              │
│  ┌────────▼──────────────────────────────────────────┐   │
│  │  components/war-room/ (비즈니스 컴포넌트 9개)       │   │
│  │  - StockProvider (Context) ← 전역 상태 공급        │   │
│  │  - AIChart, TickerBar, TechnicalScorecard 등       │   │
│  └────────┬──────────────────────────────────────────┘   │
│           │                                              │
│  ┌────────▼──────────────────────────────────────────┐   │
│  │  components/ui/ (shadcn/ui 범용 컴포넌트 57개)     │   │
│  │  - Radix UI 기반 Headless 컴포넌트                 │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  hooks/ + lib/ (공유 유틸리티)                      │   │
│  │  - useToast, useIsMobile, cn()                    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Mock Data Layer (컴포넌트 내부 하드코딩)            │   │
│  │  - STOCK_LIST, TRADE_LOG, NEWS_ITEMS 등            │   │
│  │  - generateCandles(), computeRSI() 등 계산 함수    │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 아키텍처 패턴

### 패턴: SPA 모놀리스 (Single Page Application)

- **라우팅**: Next.js App Router를 사용하지만 **단일 페이지** (`app/page.tsx`)만 존재
- **모듈 조직**: **Feature-based** -- `components/war-room/`에 도메인 컴포넌트를 분리하고, `components/ui/`에 범용 UI를 분리
- **상태 관리**: React Context API (`StockProvider`) -- 선택된 종목을 전역으로 공유
- **DDD / Clean Architecture**: 적용되지 않음. 도메인 로직(RSI 계산, MACD 계산 등)이 컴포넌트 파일 내부에 인라인으로 존재
- **컴포넌트 패턴**: Compound Component (shadcn/ui), Container/Presentational 패턴 일부 적용
- **데이터 패턴**: 모든 데이터가 **클라이언트 사이드 Mock** -- API 연동 없음

### v0.app 생성 코드 특성

이 프로젝트는 v0.app에서 생성된 프로토타입으로, 다음과 같은 특성을 보임:
- `next.config.mjs`에서 `typescript.ignoreBuildErrors: true` 설정
- `images.unoptimized: true` 설정
- `styles/globals.css`는 shadcn 기본 생성물이고, `app/globals.css`가 실제 사용되는 CSS (War Room 전용 다크 테마)
- shadcn/ui 컴포넌트 57개 중 실제 war-room에서 사용하는 것은 일부

---

## 데이터 흐름

### 페이지 렌더링 흐름

```
[브라우저 요청]
    │
    ▼
app/layout.tsx (Server Component)
    │  - 메타데이터 설정 (title, description)
    │  - Inter + JetBrains Mono 폰트 로드
    │  - globals.css 적용 (다크 테마 CSS 변수)
    │
    ▼
app/page.tsx (Server Component)
    │  - StockProvider (Client Component 경계)
    │  - 5개 섹션 배치:
    │    1. TickerBar (상단)
    │    2. AIChart + IntelligenceSidebar (중앙)
    │    3. TechnicalScorecard (하단 상)
    │    4. TradeLog (하단 하)
    │    5. AIBriefingToast (오버레이)
    │
    ▼
[Client Hydration]
```

### 종목 선택 데이터 흐름

```
사용자 ── Cmd+K 또는 클릭 ──▶ StockSearch
                                   │
                                   │ handleSelect(stock)
                                   ▼
                             StockContext.setSelected(stock)
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                AIChart      TickerBar     (기타 Consumer)
                    │
                    │ useStock().selected.basePrice
                    ▼
              generateCandles(basePrice, 48)
                    │
                    ▼
              computeRSI / computeSMA / computeBollinger / computeMACD
                    │
                    ▼
              CHART_DATA → Recharts ComposedChart 렌더링
                    │
                    ▼
              AI Scanner 오버레이 (종목 변경 시 자동 실행)
```

### AI 타점 판단 로직 흐름

```
                 ┌─────────────┐
                 │ RSI (14) 계산 │
                 └──────┬──────┘
                        │
        RSI < 30? ──YES─┤
                        │
                 ┌──────▼──────┐
                 │ MA 정배열 확인 │
                 │ MA5>MA20>MA60│
                 └──────┬──────┘
                        │
        Step 1 충족 ────┤
                        │
                 ┌──────▼──────────┐
                 │ 뉴스 긍정 비중 계산 │
                 │ (pos/total)*100  │
                 └──────┬──────────┘
                        │
        >= 70%? ───YES──┤
                        │
        Step 2 충족 ────┤
                        │
                 ┌──────▼──────┐
                 │ BUY SIGNAL   │
                 │ 차트에 다이아몬드│
                 │ 마커 표시     │
                 └─────────────┘
```

---

## 주요 모듈

| 모듈 | 파일 | 역할 | 상태 관리 |
|------|------|------|----------|
| **StockProvider** | `stock-context.tsx` | 전역 종목 선택 상태 (Context API) | `useState` + Context |
| **StockSearch** | `stock-search.tsx` | Cmd+K 종목 검색 드롭다운, 키보드 내비게이션 지원 | 로컬 `useState` |
| **TickerBar** | `ticker-bar.tsx` | 상단 실시간 시세 티커 (CSS 무한 스크롤), 시계, LIVE 뱃지 | `useEffect` (시간 갱신) |
| **AIChart** | `ai-chart.tsx` | 메인 캔들스틱 차트 -- 볼린저밴드, MA(5/20/60/120), MACD, RSI, Buy Signal 다이아몬드, 뉴스 타임라인 | 로컬 `useState` (지표 토글, 타임프레임) |
| **AIScanner** | `ai-scanner.tsx` | 종목 변경 시 레이더 애니메이션 오버레이, 4단계 분석 시뮬레이션 | `useState` + 타이머 |
| **IntelligenceSidebar** | `intelligence-sidebar.tsx` | 우측 사이드바 -- AI 타점 로직, 센티먼트 히트맵, 모멘텀 스코어, 키워드 클라우드, 뉴스 피드, DART 공시 | 로컬 `useState` |
| **TechnicalScorecard** | `technical-scorecard.tsx` | 하단 기술적 지표 패널 -- RSI 게이지(SVG), MACD 크로스, Stochastic, Williams %R, CCI, ADX, AI 종합 결론 | Mock 상수 (반응형 아님) |
| **TradeLog** | `trade-log.tsx` | 투자 복기 테이블 -- 진입가/현재가/목표가, PnL, 감정 태그, 뉴스 스냅샷, AI 전략 노트 | 로컬 `useState` (탭, 확장) |
| **AIBriefingToast** | `ai-briefing-toast.tsx` | 타이머 기반 AI 브리핑 토스트 알림 (2.5s / 9s / 17s 딜레이), 자동 소멸(7s) | `useState` + `useEffect` 타이머 |

---

## 상태 관리

### 전역 상태
- **StockContext** (`stock-context.tsx`): `selected` 종목 1개만 관리
  - `STOCK_LIST`: 한국 주식 20종목 하드코딩
  - Consumer: `AIChart`, `StockSearch`, `TickerBar`(간접)

### 로컬 상태
- 각 war-room 컴포넌트가 자체 `useState`로 UI 상태 관리
- AIChart: 지표 토글(`Indicators`), 타임프레임, 툴팁, 스캐너 표시 여부
- IntelligenceSidebar: 뉴스 카드 AI 툴팁 토글, DART 확장
- TradeLog: 활성 탭(log/strategy), 확장된 행
- AIBriefingToast: 표시 중인 토스트 목록

### 서버 상태
- **없음** -- 외부 API 호출, 데이터 페칭, 캐싱 전략 없음
- 모든 데이터가 클라이언트 사이드 Mock 상수/함수

---

## 강점

1. **일관된 디자인 시스템**: oklch 기반 CSS 변수로 다크 테마 전용 색상 체계(`--bull`, `--bear`, `--primary` Amber, `--secondary` Cyan)를 체계적으로 정의. Glassmorphism(`glass-card`), Neon Glow(`glow-amber`, `glow-cyan`) 등 시각적 일관성 우수.

2. **Feature-based 컴포넌트 분리**: `components/war-room/`에 도메인 로직을 집중시키고, `components/ui/`에 범용 UI를 분리한 명확한 2-tier 구조. 각 컴포넌트가 독립적 역할을 담당.

3. **풍부한 기술적 분석 구현**: RSI, MACD, Bollinger Bands, Stochastic, Williams %R, CCI, ADX 등 실제 기술적 분석 지표를 직접 계산하는 함수(`computeRSI`, `computeSMA`, `computeBollinger`, `computeMACD`)가 구현되어 있어 도메인 이해도가 높음.

4. **접근성 고려**: `aria-label`을 주요 섹션(`AI 타점 차트`, `인텔리전스 패널`, `기술적 스코어카드` 등)과 인터랙티브 요소에 적용. 키보드 내비게이션(StockSearch에서 ArrowUp/Down/Enter/Escape) 지원.

5. **CSS 애니메이션 활용도**: Framer Motion 없이도 순수 CSS keyframes로 ticker-scroll, radar-sweep, buy-signal-pop, toast-slide-in, scan-line, news-ping 등 12종 이상의 애니메이션을 구현. 번들 크기 최적화에 기여.

---

## 개선점

1. **Mock 데이터와 비즈니스 로직 분리 필요**: 모든 Mock 데이터(`STOCK_LIST`, `NEWS_ITEMS`, `TRADE_LOG`, `INITIAL_TICKERS`)와 계산 함수(`computeRSI`, `computeSMA` 등)가 컴포넌트 파일 내부에 인라인으로 존재. `lib/data/`, `lib/calculations/` 등으로 분리하여 테스트 가능성과 재사용성을 높여야 함.

2. **중복 파일 정리 필요**:
   - `hooks/use-toast.ts`와 `components/ui/use-toast.ts`가 동일 내용으로 중복
   - `hooks/use-mobile.ts`와 `components/ui/use-mobile.tsx`가 동일 내용으로 중복
   - `styles/globals.css`(shadcn 기본)와 `app/globals.css`(실제 사용) 2개 CSS 파일 병존. `styles/globals.css`는 사용되지 않음
   - `components/theme-provider.tsx`가 존재하나 `layout.tsx`에서 사용하지 않음

3. **TypeScript 빌드 에러 무시 (`ignoreBuildErrors: true`)**: 타입 안전성이 보장되지 않음. v0.app 생성 코드의 타입 에러를 실제로 수정하고 이 설정을 제거해야 프로덕션 안정성 확보 가능.

4. **상태 관리 확장성 부족**: 현재 Context API 하나(`StockContext`)만 사용. 향후 실시간 API 연동 시 서버 상태 관리(TanStack Query 등), WebSocket 연결 관리, 여러 종목 동시 모니터링 등의 요구에 대응하기 어려운 구조. 상태가 커질 경우 Context 하위 전체 리렌더링 이슈 예상.

5. **shadcn/ui 컴포넌트 과잉 설치**: 57개 UI 컴포넌트 중 실제 war-room에서 직접 import하여 사용하는 것은 극소수(없거나 거의 없음). war-room 컴포넌트들은 대부분 순수 HTML + Tailwind로 구현됨. 불필요한 컴포넌트를 정리하여 프로젝트 복잡도를 낮출 수 있음.

6. **TechnicalScorecard 비반응형 데이터**: RSI, MACD, Stochastic 등 지표값이 컴포넌트 최상단에 상수로 하드코딩되어 있어 종목 변경 시 갱신되지 않음. `useStock()` 컨텍스트와 연동 필요.

7. **API Route / 백엔드 부재**: 실시간 시세, 뉴스, 공시 데이터를 위한 API 연동 계층이 전혀 없음. 프로덕션으로 전환하려면 데이터 소스 추상화 레이어(`services/`, `api/`) 설계가 선행되어야 함.

---

## 종합 평가

**현재 단계**: v0.app에서 생성된 **디자인 프로토타입 / UI 목업** 수준. 시각적 완성도와 UX 설계는 높지만, 실제 데이터 연동 및 프로덕션 배포를 위한 아키텍처(API 레이어, 상태 관리 고도화, 테스트, 에러 처리)가 부재.

**프로토타입 → 프로덕션 전환 시 필요한 핵심 작업**:
1. 데이터 레이어 설계 (API Routes / External API 연동)
2. Mock 데이터를 서비스 레이어로 교체
3. 서버 상태 관리 도입 (TanStack Query 등)
4. TypeScript 빌드 에러 해결 및 `ignoreBuildErrors` 제거
5. 테스트 인프라 구축 (Vitest + React Testing Library)
6. 환경 변수 및 설정 관리 (.env)
