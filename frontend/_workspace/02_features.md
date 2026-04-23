# 기능 카탈로그

## 프로젝트 목적
"StarNion: Stocks War Room"은 한국 주식 트레이더를 위한 AI 기반 실시간 타점 분석 및 시장 인텔리전스 대시보드로, 기술적 분석/뉴스 감성 분석/AI 매수 시그널을 단일 화면에 통합하여 투자 의사결정을 지원한다.

## 주요 도메인
- **A. 마켓 모니터링** (실시간 지수/종목 시세 추적)
- **B. AI 차트 분석** (캔들스틱 차트 + 기술적 지표 + AI 매수 시그널)
- **C. 뉴스 인텔리전스** (감성 분석, 영향도 평가, 키워드 클라우드, DART 공시)
- **D. 기술적 스코어카드** (RSI/MACD/Stochastic 오실레이터 게이지)
- **E. 투자 복기 & 실행** (Trade Log, 전략 노트, 손익 추적)
- **F. AI 브리핑 & 알림** (자동 팝업 토스트 알림, AI 스캐너 오버레이)

## 기능 목록

### A. 마켓 모니터링
| 기능 | 설명 | 성숙도 | 위치 |
|------|------|--------|------|
| 스크롤링 마켓 티커 | KOSPI/KOSDAQ/NASDAQ/S&P500/USD-KRW/BTC 등 12개 지표가 자동 스크롤. 호버 시 일시정지 | Experimental | `components/war-room/ticker-bar.tsx` |
| 현재 시간 표시 | KST 기준 실시간 시계 (1초 갱신) | Stable | `components/war-room/ticker-bar.tsx` |
| LIVE 상태 표시 | 시장 실시간 상태 인디케이터 (pulse dot 애니메이션) | Experimental | `components/war-room/ticker-bar.tsx` |
| 종목 검색 (Cmd+K) | 종목명/코드/섹터로 20개 종목 검색. 키보드 내비게이션(화살표/Enter/Esc), 최근 조회 목록, 마켓 배지 표시 | Stable | `components/war-room/stock-search.tsx` |
| 종목 컨텍스트 전환 | 종목 선택 시 전체 대시보드 데이터 연동 (Context API) | Stable | `components/war-room/stock-context.tsx` |

### B. AI 차트 분석
| 기능 | 설명 | 성숙도 | 위치 |
|------|------|--------|------|
| 캔들스틱 차트 | Recharts ComposedChart 기반 OHLC 캔들 (양봉/음봉 색상 구분, 48개 봉) | Stable | `components/war-room/ai-chart.tsx` |
| 이동평균선 (MA) | MA5/MA20/MA60/MA120 토글 가능. 각각 고유 색상 | Stable | `components/war-room/ai-chart.tsx` |
| 볼린저 밴드 | 20일/2표준편차 밴드 + 중심선 + 채운 영역 표시 | Stable | `components/war-room/ai-chart.tsx` |
| 거래량 프로파일 | 하단 바 차트, 양봉/음봉 색상 구분 | Stable | `components/war-room/ai-chart.tsx` |
| RSI 서브차트 | RSI(14) 별도 차트 영역. 30/70 기준선 + 과매도/과매수 구간 색상 | Stable | `components/war-room/ai-chart.tsx` |
| MACD 계산 | EMA12/EMA26 기반 MACD 값 계산 (차트 데이터에 포함) | Stable | `components/war-room/ai-chart.tsx` |
| AI Diamond Buy Signal | RSI < 32 조건 시 다이아몬드 마커 + "BUY" 라벨 표시. 호버 시 뉴스 기반 트리거 사유 팝업 | Stable | `components/war-room/ai-chart.tsx` |
| 지지선/저항선 영역 | ReferenceArea로 자동 계산된 지지/저항 구간 표시 | Stable | `components/war-room/ai-chart.tsx` |
| 뉴스 타임라인 바 | 차트 하단에 뉴스 이벤트 도트. 호버 시 해당 봉 영역 하이라이트 + 뉴스 툴팁 | Stable | `components/war-room/ai-chart.tsx` |
| 지표 제어 툴바 | 플로팅 툴바에서 MA5/MA20/MA60/MA120/볼린저/거래량 개별 토글 (Eye/EyeOff 아이콘) | Stable | `components/war-room/ai-chart.tsx` |
| 타임프레임 선택 | 1분/5분/15분/1시간/일봉 탭 UI (현재 시각적 전환만, 데이터 동일) | Experimental | `components/war-room/ai-chart.tsx` |
| 커스텀 툴팁 | 호버 시 시가/고가/저가/종가/MA5/MA20/RSI + Buy Signal 여부 표시 | Stable | `components/war-room/ai-chart.tsx` |
| AI 스캐너 오버레이 | 종목 전환 시 레이더 애니메이션 + 4단계 분석 진행 표시. 완료 후 "Buy Signal 생성 완료" 표시 | Stable | `components/war-room/ai-scanner.tsx` |

### C. 뉴스 인텔리전스
| 기능 | 설명 | 성숙도 | 위치 |
|------|------|--------|------|
| 24시간 센티먼트 히트맵 | 시간대별 긍정/부정 뉴스 분포 바 차트 (08시~18시). 전체 긍정/부정 비율 바 + AI 타점 Step2 충족 여부 | Stable | `components/war-room/intelligence-sidebar.tsx` |
| AI 뉴스 피드 | 7건의 뉴스 카드. 감성(호/악/중) 배지 + Impact(Critical/High/Moderate) 배지 + 키워드 태그. Info 버튼 호버 시 AI 분석 요약 툴팁 | Stable | `components/war-room/intelligence-sidebar.tsx` |
| 모멘텀 스코어 | RadialBarChart 게이지 (0~100). 수급/기술적 지표/뉴스 센티먼트 3축 세부 바 | Stable | `components/war-room/intelligence-sidebar.tsx` |
| 트렌딩 키워드 클라우드 | 12개 키워드 태그. weight(high/mid/low)별 크기, sentiment별 색상 | Stable | `components/war-room/intelligence-sidebar.tsx` |
| AI 타점 로직 (3단계) | Step1: RSI 과매도 + 이평선 정배열, Step2: 뉴스 긍정 비중 70%+, Step3: Buy Signal 마킹. 전체 충족 시 "BUY SIGNAL" 배지 + glow 효과 | Stable | `components/war-room/intelligence-sidebar.tsx` |
| DART 공시 알리미 | 배당/자사주/공시/유증 분류 배지 + 아코디언 확장으로 요약 보기 | Stable | `components/war-room/intelligence-sidebar.tsx` |

### D. 기술적 스코어카드
| 기능 | 설명 | 성숙도 | 위치 |
|------|------|--------|------|
| RSI 아크 게이지 | SVG 반원 게이지 (0~100). 과매도(<30)/과매수(>70)/중립 구간 색상 + 바늘 표시 | Stable | `components/war-room/technical-scorecard.tsx` |
| MACD 크로스 상태 | 골든크로스/데드크로스 판별. 아이콘 + 차이값 표시 | Stable | `components/war-room/technical-scorecard.tsx` |
| Stochastic %K/%D | 프로그레스 바 + 과매도/과매수 구간 표시 | Stable | `components/war-room/technical-scorecard.tsx` |
| 보조 오실레이터 | Williams %R / CCI / ADX 각각 상태(과매도/중립/추세강함) + 색상 표시 | Stable | `components/war-room/technical-scorecard.tsx` |
| AI 종합 결론 | 기술적(Bullish/Neutral/Bearish) + 센티먼트(Positive) 종합. 매수 추천 문구 + 조건 배지 | Stable | `components/war-room/technical-scorecard.tsx` |

### E. 투자 복기 & 실행
| 기능 | 설명 | 성숙도 | 위치 |
|------|------|--------|------|
| Trade Log 테이블 | 종목/진입가/현재가/목표가/손익(%)/상태(보유중/종료/목표달성)/감정(확신/불안/중립/흥분) 표시. 클릭 시 상세 확장(뉴스 스냅샷 + 전략 노트) | Stable | `components/war-room/trade-log.tsx` |
| 목표 달성 진행률 | 보유중 종목에 대해 진입가->목표가 프로그레스 바 | Stable | `components/war-room/trade-log.tsx` |
| 포트폴리오 평가손익 | 보유중 종목 전체 평가손익 합계 표시 | Stable | `components/war-room/trade-log.tsx` |
| AI 전략 노트 탭 | Trade Log/AI 전략 노트 탭 전환. 전략 노트 탭에서 종목별 전략 메모 카드 리스트 | Stable | `components/war-room/trade-log.tsx` |
| 매수 기록 버튼 | "매수 기록" 버튼 UI (클릭 핸들러 미구현) | Stub | `components/war-room/trade-log.tsx` |

### F. AI 브리핑 & 알림
| 기능 | 설명 | 성숙도 | 위치 |
|------|------|--------|------|
| AI 브리핑 토스트 | 시간차(2.5초/9초/17초)로 자동 표시되는 알림. buy/alert/info 타입별 색상 + 아이콘. 7초 후 자동 소멸, 수동 닫기 가능. 프로그레스 바 드레인 애니메이션 | Stable | `components/war-room/ai-briefing-toast.tsx` |

## 사용자 여정

### 1. 대시보드 진입 -> 종목 분석 -> 매매 판단
1. 페이지 로드 시 기본 종목(삼성전자) 대시보드가 표시됨
2. 상단 티커 바에서 시장 지수(KOSPI/KOSDAQ/NASDAQ)와 주요 종목 등락률을 한눈에 확인
3. AI 브리핑 토스트가 순차적으로 표시되어 주요 종목 알림 확인
4. 차트에서 AI Diamond Buy Signal 위치와 RSI 과매도 구간을 확인
5. 우측 인텔리전스 패널에서 뉴스 감성 분석과 AI 타점 3단계 로직 충족 여부 확인
6. 하단 기술적 스코어카드에서 RSI/MACD/Stochastic 종합 판단과 AI 결론 확인
7. Trade Log에서 기존 포지션 손익과 전략 노트를 복기

### 2. 종목 전환 -> AI 분석 스캔
1. 상단 Cmd+K (또는 검색 버튼) 클릭으로 종목 검색 드롭다운 오픈
2. 종목명/코드/섹터로 검색 후 키보드 또는 마우스로 선택
3. AI 스캐너 오버레이가 표시되며 4단계(RSI 탐색/이평선 분석/뉴스 센티먼트/종합) 분석 진행
4. 분석 완료 후 새 종목의 차트/지표/인텔리전스가 전체 갱신

### 3. 뉴스-차트 연동 분석
1. 차트 하단 뉴스 타임라인에서 뉴스 이벤트 도트에 호버
2. 해당 시점의 차트 영역이 하이라이트되고, 뉴스 헤드라인/출처/시간이 팝업
3. 우측 뉴스 피드에서 개별 뉴스의 AI 분석 요약(Info 아이콘 호버)을 통해 과거 패턴 기반 예측 확인
4. DART 공시 알리미에서 자사주 매입/배당/전환사채 등 주요 공시 확인

## 외부 통합
| 서비스 | 용도 |
|--------|------|
| Vercel Analytics (`@vercel/analytics`) | 페이지 방문 통계 수집 |
| v0.app (코드 생성) | 프로젝트 초기 프론트엔드 UI 생성 도구 |

> 참고: 실시간 시세 API, 뉴스 크롤링 API, AI 분석 백엔드 등 **외부 데이터 소스 연동은 현재 없음**. 모든 데이터가 Mock(하드코딩)으로 구현되어 있다.

## 차별화 포인트
- **AI 타점 3단계 로직 시각화**: RSI 과매도 + 이평선 정배열 + 뉴스 긍정 비중 70%+를 3단계 체크리스트로 시각화하고, 충족 시 차트에 Diamond Signal을 마킹하는 독자적 UX
- **뉴스-차트 연동 타임라인**: 차트 X축 하단에 뉴스 이벤트를 시간축 동기화하여 표시하고, 호버 시 해당 봉 영역을 하이라이트하는 양방향 인터랙션
- **AI 스캐너 레이더 애니메이션**: 종목 전환 시 레이더 스윕 + 단계별 분석 진행을 시네마틱하게 연출하여 AI 분석 과정을 체감시키는 UX
- **투자 감정 태그 + 뉴스 스냅샷 기록**: Trade Log에 매매 시점의 감정 상태(확신/불안/중립/흥분)와 뉴스 스냅샷을 함께 기록하여 투자 복기를 지원
- **"작전실" 테마 디자인**: glassmorphism 카드, amber/cyan neon glow, 다크 배경, 레이더 스윕 등 밀리터리 작전실 컨셉의 일관된 비주얼 시스템

## 성숙도 요약
- **Stable**: 30개 (캔들스틱 차트, MA/볼린저/거래량 오버레이, RSI 서브차트, AI Diamond Signal, 뉴스 타임라인, 지표 툴바, 종목 검색, AI 스캐너, 센티먼트 히트맵, 뉴스 피드, 모멘텀 스코어, 키워드 클라우드, AI 타점 로직, DART 공시, RSI 게이지, MACD 크로스, Stochastic, 보조 오실레이터, AI 종합 결론, Trade Log, 목표 진행률, 포트폴리오 손익, 전략 노트 탭, AI 브리핑 토스트, 종목 컨텍스트, 현재 시간 표시 등)
- **In Progress**: 0개
- **Experimental**: 3개 (스크롤링 마켓 티커, LIVE 상태 표시, 타임프레임 선택)
- **Stub**: 1개 (매수 기록 버튼)

## 강점
- **UI 완성도가 매우 높음**: v0.app으로 생성된 프론트엔드이지만, 컴포넌트 분리가 깔끔하고 인터랙션(호버 툴팁, 키보드 내비게이션, 애니메이션)이 풍부하여 프로토타입 수준을 넘어선 완성도
- **단일 화면 통합 대시보드**: 차트/뉴스/기술적 지표/트레이드 로그를 한 화면에 배치하여 화면 전환 없이 종합적 분석 가능
- **기술적 분석 기능 완비**: RSI/MACD/Stochastic/Williams %R/CCI/ADX 6개 오실레이터 + 4개 이동평균선 + 볼린저 밴드를 모두 구현
- **Context API를 통한 종목 연동**: 종목 선택 시 차트/지표가 자동 연동되는 상태 관리 구조가 잘 설계됨
- **CSS 애니메이션 시스템 체계적**: ticker-scroll, radar-sweep, step-reveal, news-ping, toolbar-pop 등 10개 이상의 커스텀 애니메이션이 globals.css에 체계적으로 정의

## 개선점
- **모든 데이터가 Mock**: 실시간 시세 API, 뉴스 크롤링 API, AI 분석 백엔드가 전혀 연동되지 않아 실제 사용 불가. 20개 종목의 하드코딩된 가격/뉴스/공시 데이터만 존재
- **테스트 코드 부재**: `.test.*`, `.spec.*`, `__tests__` 파일이 전혀 없음
- **타임프레임 전환 미구현**: 1분/5분/15분/1시간/일봉 탭이 시각적으로만 존재하며, 실제 데이터 전환 없음 (모든 타임프레임이 동일 Mock 데이터)
- **매수 기록 CRUD 미구현**: "매수 기록" 버튼 UI만 존재하고 클릭 핸들러/입력 폼/저장 로직이 없음. Trade Log가 읽기 전용
- **백엔드/API 레이어 부재**: Next.js의 API Routes나 Server Actions를 전혀 사용하지 않음. 순수 프론트엔드 SPA 구조
- **데이터 영속성 없음**: localStorage, 데이터베이스, 외부 저장소 연동이 전혀 없어 새로고침 시 상태 초기화
- **반응형 미흡**: 데스크톱 전용 레이아웃. `use-mobile.ts` 훅이 존재하나 실제 모바일 대응 레이아웃은 구현되지 않음
- **단일 페이지 구조**: `app/page.tsx` 하나만 존재. 설정/포트폴리오/히스토리 등 추가 페이지 없음
- **인증/사용자 관리 없음**: 로그인/회원가입/개인화 기능이 전혀 없음
