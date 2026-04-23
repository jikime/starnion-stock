# UI/UX 분석 — StarNion: Stocks War Room

## 요약

| 항목 | 내용 |
|------|------|
| 프론트엔드 프레임워크 | Next.js 16.2.0 (App Router, React 19, RSC 지원) |
| UI 라이브러리 | shadcn/ui (new-york 스타일) + Radix UI 프리미티브 57개 |
| 디자인 시스템 | 자체 커스텀 (shadcn 기반, Cyberpunk Financial 테마) |
| 다크 모드 | Always-Dark (라이트 모드 없음, `:root`에 다크 토큰 고정) |
| 반응형 | Desktop-first, 모바일 대응 극히 제한적 |
| 생성 도구 | v0.app (metadata.generator에 명시) |
| 빌드 도구 | Tailwind CSS v4.2 + PostCSS |

---

## 컴포넌트 구조

### 조직 방식: Feature-based + Primitives 분리

```
components/
├── ui/              # 57개 shadcn 프리미티브 (Radix 기반)
│   ├── button.tsx, card.tsx, dialog.tsx, toast.tsx ...
│   ├── empty.tsx, field.tsx, item.tsx, kbd.tsx      # v0.app 추가 컴포넌트
│   ├── spinner.tsx, button-group.tsx, input-group.tsx
│   ├── use-mobile.tsx  # (hooks 폴더에도 중복 존재)
│   └── use-toast.ts    # (hooks 폴더에도 중복 존재)
│
├── war-room/        # 9개 도메인 컴포넌트 (핵심 비즈니스 로직)
│   ├── stock-context.tsx       # React Context 전역 상태 (선택 종목)
│   ├── stock-search.tsx        # 종목 검색 (Ctrl+K, 키보드 내비게이션)
│   ├── ticker-bar.tsx          # 상단 스크롤 티커 바
│   ├── ai-chart.tsx            # 메인 차트 (Recharts ComposedChart)
│   ├── ai-scanner.tsx          # 종목 변경 시 레이더 스캔 오버레이
│   ├── intelligence-sidebar.tsx # 우측 사이드바 (뉴스, 히트맵, 키워드 등)
│   ├── technical-scorecard.tsx  # 하단 기술적 지표 패널
│   ├── trade-log.tsx           # 투자 복기 테이블
│   └── ai-briefing-toast.tsx   # AI 브리핑 토스트 알림
│
hooks/
├── use-mobile.ts    # 모바일 감지 (768px 기준)
└── use-toast.ts     # 토스트 상태 관리 (reducer 패턴)

lib/
└── utils.ts         # cn() 유틸리티 (clsx + tailwind-merge)
```

### 분석

- **ui/ 폴더**: shadcn/ui CLI로 생성된 표준 컴포넌트 57개. v0.app이 전부 설치한 것으로 보이며, 실제 war-room에서 직접 사용하는 컴포넌트는 일부에 불과함 (Button, Card 등은 직접 import되지 않고, war-room 컴포넌트 내부에서 Tailwind 클래스로 직접 스타일링)
- **war-room/ 폴더**: 실질적인 애플리케이션 UI. 각 컴포넌트가 자체 Mock 데이터를 포함하고, 외부 API 연동 없이 데모 목적으로 작성됨
- **hooks 중복**: `use-mobile.tsx`가 `components/ui/`와 `hooks/` 양쪽에 존재. 정리 필요

---

## 디자인 토큰

### 색상 시스템 (OKLCH 기반)

`app/globals.css`의 `:root`에서 OKLCH 색상 체계로 통일 정의:

| 토큰 | OKLCH 값 | 용도 |
|------|----------|------|
| `--background` | `oklch(0.10 0.015 250)` | 기본 배경 (Deep Navy) |
| `--surface` | `oklch(0.14 0.018 250)` | 카드/패널 배경 |
| `--surface-raised` | `oklch(0.17 0.018 250)` | 높은 elevation 배경 |
| `--primary` | `oklch(0.78 0.17 74)` | Amber 악센트 (AI/Buy 시그널) |
| `--secondary` | `oklch(0.72 0.15 196)` | Cyan 악센트 (데이터/라이브) |
| `--bull` | `oklch(0.70 0.19 152)` | 상승/긍정 (Green) |
| `--bear` | `oklch(0.60 0.22 27)` | 하락/부정 (Red) |
| `--chart-1~5` | 다양 | 차트 전용 색상 5종 |

### PRD 대비 색상 격차

| PRD 요구 | 실제 구현 | 상태 |
|----------|----------|------|
| Deep Navy (#0B0E14) | `oklch(0.10 0.015 250)` (유사) | 충족 |
| Cyan (#00FFFF) | `oklch(0.72 0.15 196)` (덜 채도 높음) | 근접 |
| Electric Purple (#BF00FF) | 미구현 (chart-5에 유사 톤 존재) | **미충족** |
| Neon Green/Red | `--bull`/`--bear` 정의됨 | 충족 |

### 타이포그래피

- **Sans**: Inter (Google Fonts, CSS Variable `--font-inter`)
- **Mono**: JetBrains Mono (Google Fonts, CSS Variable `--font-jetbrains-mono`)
- `font-mono` 클래스가 대부분의 데이터 표시에 사용됨 (숫자, 가격, 코드 등)
- 크기 스케일: Tailwind 기본 스케일 사용 (`text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`, `text-base`, `text-2xl`)
- **매우 작은 크기 다수 사용**: `text-[9px]`~`text-[10px]`가 빈번 -> 가독성 우려

### 간격 및 반경

- 간격: Tailwind 기본 4px 스케일 (`gap-0.5`, `gap-1`, `gap-2`, `gap-3`, `p-3`, `p-4` 등)
- 반경: `--radius: 0.5rem`, `rounded-xl`(카드), `rounded-lg`(버튼), `rounded-full`(뱃지)
- 그림자: `box-shadow` 기반 네온 글로우 (`glow-amber`, `glow-cyan`, `glow-bull`, `glow-bear`)

### 다크 모드 토큰

- Always-Dark 디자인: `:root`에 다크 토큰만 정의
- `styles/globals.css`에 light/dark 양쪽 토큰이 존재하지만, 이는 shadcn 기본 파일이며 **사용되지 않음**
- `app/globals.css`가 실제 적용 파일 (layout.tsx에서 import)
- `<html>` 태그에 `dark` 클래스 미적용 -> `@custom-variant dark` 사용하지만 실제로는 `:root` 단일 테마

---

## 주요 페이지

| 경로 | 용도 |
|------|------|
| `/` (page.tsx) | War Room 메인 대시보드 (단일 페이지 앱) |

> **SPA 구조**: 페이지가 `/` 하나만 존재. 모든 기능이 단일 화면에 배치됨.

---

## 네비게이션

### 구조: Single-Page 고정 레이아웃

```
+------------------------------------------------------------+
| TickerBar (h-10, sticky top)                  | StockSearch |
+------------------------------------------------------------+
| AIChart (flex-1)            | IntelligenceSidebar (w-80~96)|
|                             |   - AI Signal Steps          |
|                             |   - Sentiment Heatmap        |
|                             |   - Momentum Score           |
|                             |   - Keyword Cloud            |
|                             |   - News Feed                |
|                             |   - DART Feed                |
+------------------------------------------------------------+
| TechnicalScorecard (h-44)                                  |
+------------------------------------------------------------+
| TradeLog (h-48)                                            |
+------------------------------------------------------------+
| Footer (disclaimer)                                        |
+------------------------------------------------------------+
```

- **라우팅**: 없음 (단일 페이지)
- **모달 전략**: 없음 (커스텀 드롭다운, 툴팁만 사용)
- **사이드바**: 고정 폭 (w-80, xl:w-96)
- **종목 검색**: Command Palette 스타일 (Ctrl+K 바인딩, 커스텀 구현)
- **탭**: TradeLog 내부에 'Trade Log' / 'AI 전략 노트' 탭 (커스텀)
- **확장/접기**: TradeLog 행 클릭 시 확장, DART Feed 아코디언

---

## 상태 관리 (클라이언트)

| 카테고리 | 구현 방식 |
|----------|----------|
| **전역 상태** | React Context (`StockContext`) — 선택 종목 1개만 관리 |
| **서버 상태** | 없음 (Mock 데이터, API 호출 없음) |
| **클라이언트 상태** | 각 컴포넌트 내 `useState` (로컬 상태) |
| **폼** | 없음 (react-hook-form 설치됨, 미사용) |
| **토스트/알림** | 커스텀 AIBriefingToast (타이머 기반 시퀀셜 표시) + sonner 설치됨 |
| **서드파티 상태 관리** | 없음 (Zustand, Redux 없음) |

### 상태 흐름

```
StockProvider (Context)
  └─> useStock() hook
       ├─> TickerBar (읽기)
       ├─> StockSearch (읽기/쓰기)
       ├─> AIChart (읽기 → 차트 데이터 재생성)
       └─> AIScanner (종목 변경 감지 → 스캔 애니메이션)
```

### 설치되었으나 미사용 라이브러리

- `react-hook-form` + `@hookform/resolvers` + `zod`: 폼 스키마 없음
- `react-resizable-panels`: 패널 리사이즈 미구현
- `next-themes`: 다크 모드 토글 미구현 (Always-Dark)
- `sonner`: 커스텀 토스트 사용
- `react-day-picker`: 캘린더 미사용
- `embla-carousel-react`: 캐러셀 미사용
- `input-otp`: OTP 입력 미사용
- `vaul`: Drawer 미사용
- `cmdk`: Command Menu 미사용 (커스텀 검색 구현)

---

## 접근성 (a11y)

### ARIA 사용: 기본 수준

| 요소 | 접근성 지원 | 상세 |
|------|------------|------|
| 메인 레이아웃 `<section>` | `aria-label` 한국어 | "AI 타점 차트", "인텔리전스 패널", "기술적 스코어카드", "투자 복기 및 실행" |
| 토스트 영역 | `role="region"` + `aria-label` | "AI 브리핑 알림" |
| 종목 검색 | `aria-label` + `role="listbox"` + `role="option"` + `aria-selected` | 비교적 잘 구현됨 |
| RSI 게이지 SVG | `aria-label` | "RSI {value}" |
| 뉴스 이벤트 버튼 | `aria-label` | 헤드라인 텍스트 |
| 닫기 버튼 | `aria-label` | "닫기" |

### 키보드 내비게이션: 부분 지원

- **종목 검색**: Ctrl+K 열기, 화살표 이동, Enter 선택, Esc 닫기 (잘 구현)
- **지표 토글 버튼**: 클릭만, 키보드 포커스 기본 지원
- **TradeLog 행 확장**: onClick만 (키보드 접근 불가)
- **DART Feed 확장**: onClick만 (키보드 접근 불가)
- **뉴스 AI 툴팁**: onMouseEnter/Leave만 (키보드 접근 불가)
- **키워드 클라우드**: `<button>` 사용 (포커스 가능하지만 기능 없음)

### 개선 필요 사항

- `<html lang="ko">` 설정됨 (좋음)
- 색상 대비: 작은 텍스트(`text-[9px]`)에서 `text-muted-foreground`(oklch 0.55)는 배경(oklch 0.10) 대비 WCAG AA 기준 통과 추정이나, 정밀 검증 필요
- focus-visible 스타일: shadcn 컴포넌트에는 있으나 war-room 커스텀 요소에는 부재
- 스크린 리더: 동적 콘텐츠(티커 스크롤, 토스트) 고지 부족 (`aria-live` 미사용)
- Skip navigation 링크 없음

---

## 반응형 전략

### 브레이크포인트 활용: 극히 제한적

| 브레이크포인트 | 사용 위치 |
|---------------|----------|
| `sm:` | StockSearch의 `kbd` 표시 (1개소) |
| `lg:` | TradeLog의 '목표 진행' 열 표시/숨김 (2개소) |
| `xl:` | IntelligenceSidebar 너비 (`w-80 xl:w-96`) (1개소) |

### 문제점

1. **모바일 완전 미대응**: `h-screen overflow-hidden` 고정 레이아웃으로 작은 화면에서 콘텐츠 절단
2. **사이드바 고정**: `w-80` (320px) 고정 너비 -> 768px 이하에서 차트 영역 극도로 압축
3. **패널 높이 고정**: `h-44`, `h-48`로 하단 패널 고정 -> 작은 화면에서 메인 차트 공간 부족
4. **수평 스크롤 없음**: 테이블 등이 narrow 화면에서 깨질 가능성
5. `useIsMobile()` hook 존재하나 **어디에서도 사용되지 않음**
6. `react-resizable-panels` 설치되었으나 미사용 -> 패널 리사이즈로 반응형 보완 가능

---

## 마이크로 인터랙션

### 애니메이션 라이브러리: CSS Custom Animations (Framer Motion 미사용)

PRD에서 언급된 Framer Motion은 **설치되어 있지 않음**. 대신 CSS keyframes로 풍부한 애니메이션 구현:

| 애니메이션 | CSS 클래스 | 용도 |
|-----------|-----------|------|
| `ticker-scroll` | `.ticker-track` | 상단 시세 무한 스크롤 (40s linear) |
| `pulse-dot` | `.live-dot` | LIVE 뱃지 펄스 (1.5s) |
| `buy-signal-pop` | `.buy-signal-icon` | 매수 신호 팝 효과 (0.5s) |
| `slide-in-right` | `.toast-slide-in` | 토스트 슬라이드 인 (0.4s cubic-bezier) |
| `radar-sweep` | `.radar-sweep` | AI 스캐너 레이더 회전 (2s linear infinite) |
| `step-reveal` | `.step-reveal` | 스캐너 단계 페이드 인 (0.35s) |
| `scan-line` | `.scan-line` | 차트 스캔 라인 (1.8s) |
| `news-ping` | `.news-ping` | 뉴스 이벤트 핑 (1.4s) |
| `toolbar-pop` | `.toolbar-pop` | 플로팅 툴바 팝업 (0.2s) |
| `progress-drain` | (style jsx) | 토스트 프로그레스 바 (7s linear) |

### Glassmorphism

`glass-card` 클래스가 거의 모든 카드/패널에 적용:
```css
.glass-card {
  background: rgba(20, 25, 45, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.06);
}
```
사용 빈도: war-room 컴포넌트에서 약 19회 사용 (모든 카드, 패널, 오버레이)

### Neon Glow 효과

4종류 글로우 유틸리티 + 텍스트 글로우:
- `.glow-amber`: AI/Buy 시그널
- `.glow-cyan`: 데이터/라이브 정보
- `.glow-bull`: 상승 상태
- `.glow-bear`: 하락 상태
- `.text-glow-amber`, `.text-glow-cyan`: 텍스트 네온 효과

### 호버 상태

- 티커 트랙: `hover` 시 애니메이션 일시정지
- 뉴스 카드: `hover:bg-muted/30`, 헤드라인 색상 변경
- 버튼: `hover:bg-primary/20`, opacity 변경
- 테이블 행: `hover:bg-muted/30`

### 로딩/스캔 상태

- **AI Scanner 오버레이**: 종목 변경 시 전체 차트를 덮는 레이더 스캔 애니메이션 (4단계 순차 진행)
- **스켈레톤**: `skeleton.tsx` 존재하나 실제 사용 안됨

---

## PRD 대비 구현 격차 분석

| PRD 요구사항 | 구현 상태 | 격차 |
|-------------|----------|------|
| Cyberpunk Financial Theme | 충족 | Deep navy + amber/cyan 구현 완료 |
| Electric Purple (#BF00FF) | **미충족** | Purple은 볼린저 밴드에만 부분 사용 (#a78bfa) |
| Glassmorphism (backdrop-blur-md) | 충족 | `glass-card` 클래스로 blur(12px) 일관 적용 |
| 4-Panel Layout | **부분 충족** | 8:4 비율이 아닌 flex-1 + w-80 고정. `react-resizable-panels` 미활용 |
| Neon Green/Red 시각적 대비 | 충족 | `--bull`/`--bear` + glow 효과 |
| Framer Motion 애니메이션 | **미충족** | 미설치. CSS @keyframes로 대체 구현 (기능적으로 충분) |
| Recharts 차트 | 충족 | ComposedChart, RadialBarChart 등 활용 |
| 실시간 데이터 | **미충족** | 전부 Mock 데이터. WebSocket/API 연동 없음 |
| AI 분석 로직 | **미충족** | 로직 자체는 하드코딩. 실제 AI 모델 연동 없음 |

---

## 강점

1. **일관된 디자인 시스템**: OKLCH 색상 체계를 통한 일관성 있는 토큰 관리. `--bull`/`--bear`/`--primary`/`--secondary`로 의미론적 색상 분리가 잘 되어 있음
2. **풍부한 마이크로 인터랙션**: Framer Motion 없이도 10개 이상의 CSS keyframe 애니메이션으로 Cyberpunk 분위기를 효과적으로 연출
3. **Glassmorphism 일관성**: `glass-card` 유틸리티 클래스를 통해 모든 패널에 통일된 반투명 유리 효과 적용
4. **종목 검색 UX**: Ctrl+K 단축키, 키보드 내비게이션, 최근 조회, 실시간 필터링 등 잘 구현된 Command Palette 패턴
5. **AI Scanner 연출**: 종목 변경 시 레이더 스캔 오버레이는 Cyberpunk 테마에 부합하는 인상적인 인터랙션
6. **정보 밀도**: 단일 화면에 시세, 차트, 뉴스, 기술 지표, 거래 로그, AI 결론을 모두 배치하여 트레이더 워크플로우에 맞는 정보 밀도 제공
7. **글로우 효과 계층**: glow-amber(AI) > glow-cyan(데이터) > glow-bull/bear(상태) 순으로 시각적 계층 구조가 명확
8. **한국어 UX**: `<html lang="ko">`, 한국 시장 데이터, 한국어 UI 텍스트, KST 시간 표시

---

## 개선점

### 높은 우선순위

1. **반응형 디자인 전면 개편 필요**: 현재 데스크톱 전용. `overflow-hidden` + 고정 높이 패널 구조로 태블릿/모바일에서 사용 불가. 최소한 태블릿(1024px) 대응을 위해 사이드바 접기/펼치기, 패널 스태킹 필요
2. **react-resizable-panels 활용**: 설치되어 있으나 미사용. 패널 리사이즈 기능으로 사용자 맞춤 레이아웃 제공 가능
3. **미사용 패키지 정리**: react-hook-form, cmdk, vaul, next-themes, embla-carousel 등 번들 사이즈에 영향을 줄 수 있는 미사용 의존성 정리
4. **접근성 강화**: TradeLog/DART 행 확장에 `<button>` 또는 키보드 이벤트 추가, 뉴스 AI 툴팁에 focus 트리거 추가, 동적 콘텐츠에 `aria-live` 적용

### 중간 우선순위

5. **Electric Purple 누락**: PRD의 핵심 색상 중 하나인 Electric Purple이 디자인 토큰에 없음. `--accent-purple` 또는 유사 변수 추가 필요
6. **실제 API 연동 아키텍처**: 현재 모든 데이터가 컴포넌트 내 하드코딩. TanStack Query 등 서버 상태 관리 도입하여 Mock -> 실제 데이터 전환 준비
7. **hooks 중복 정리**: `use-mobile.tsx`가 `components/ui/`와 `hooks/` 양쪽에 존재
8. **텍스트 크기 가독성**: `text-[9px]`~`text-[10px]` 사용이 매우 빈번. 최소 크기를 `text-[10px]` 또는 `text-[11px]`로 올리는 것 권장 (특히 WCAG 기준)

### 낮은 우선순위

9. **styles/globals.css 정리**: shadcn 기본 light/dark 테마 파일이 남아있으나 사용되지 않음. 혼란 방지를 위해 제거 또는 통합
10. **Framer Motion 도입 고려**: CSS 애니메이션으로 충분하지만, 향후 복잡한 인터랙션(드래그, 제스처, layout 애니메이션) 필요 시 Framer Motion 도입 검토
11. **TypeScript 빌드 에러 무시**: `next.config.mjs`에서 `ignoreBuildErrors: true` 설정. 타입 안전성을 위해 해제 후 오류 수정 필요
12. **shadcn 컴포넌트 활용도 향상**: 57개 프리미티브 중 실제 war-room에서 직접 사용하는 것이 극소수. 기존 shadcn Card, Dialog, Sheet, Tabs 등을 활용하면 접근성과 일관성 자동 확보

---

## 기술 스택 요약

```
Framework:    Next.js 16.2.0 (App Router, RSC)
React:        19.x
Styling:      Tailwind CSS 4.2.0 + tw-animate-css
UI Library:   shadcn/ui (new-york) + Radix UI
Charts:       Recharts 2.15.0
Icons:        Lucide React 0.564.0
Font:         Inter + JetBrains Mono (Google Fonts)
Toast:        Custom AIBriefingToast + sonner (설치됨, 미사용)
Animation:    CSS Keyframes (10+ custom animations)
State:        React Context + useState
Build:        pnpm + TypeScript 5.7.3
```
