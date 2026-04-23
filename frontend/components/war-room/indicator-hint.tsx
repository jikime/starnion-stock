'use client'

import type { ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * 지표 설명 사전. 키 = 지표 키, 값 = 간단 설명.
 */
export const INDICATOR_HINTS: Record<string, string> = {
  RSI: 'Relative Strength Index (14일). 0~100 범위. 30 미만은 과매도(반등 기대), 70 초과는 과매수(조정 주의).',
  MACD: 'Moving Average Convergence Divergence. 단기/장기 이동평균의 차이. 시그널선 상향 돌파(골든크로스)는 상승 전환 신호.',
  Stochastic:
    '%K/%D. 0~100. 20 미만 과매도, 80 초과 과매수. 단기 매매 타이밍 판단에 유용.',
  'Williams %R':
    '-100~0 범위. -20 초과는 과매수, -80 미만은 과매도. RSI 와 유사하나 역방향 스케일.',
  CCI: 'Commodity Channel Index. -100~+100 범위가 정상. ±100 벗어나면 강한 추세.',
  ADX: 'Average Directional Index. 0~100. 25 초과는 강한 추세(방향 무관). 20 미만은 횡보장.',
  BollingerBands:
    '20일 이동평균 ±2σ. 상단 돌파는 과매수, 하단 터치는 과매도. 밴드 폭은 변동성.',
  VWAP: 'Volume Weighted Average Price. 거래량 가중 평균가. 기관·세력의 평균 매수 단가 추정치.',
  MA5: '5일 단순이동평균. 초단기 추세.',
  MA20: '20일 이동평균. 단기 추세의 핵심 기준선. 눌림목 매수 타깃.',
  MA60: '60일 이동평균. 중기 추세. 3개월 추세 확인.',
  MA120: '120일 이동평균. 6개월 장기 추세.',
  MA200: '200일 이동평균. 장기 추세선. 리버모어의 핵심 기준.',
  '볼린저':
    '20일 이동평균 ±2σ 밴드. 상단 돌파는 과매수, 하단 터치는 과매도. 밴드 폭이 좁아지면 변동성 확대 예고(스퀴즈).',
  '거래량':
    '주식 거래 수량. 추세 전환 시 거래량 급증이 동반되어야 신뢰도 높음. 가격보다 거래량이 먼저 움직이는 경우가 많음.',
  Pivot:
    '전일 High/Low/Close 기반 계산. P = (H+L+C)/3. R1 돌파는 상승 전환점.',
  ROE: 'Return on Equity. 자기자본 대비 순이익. 15% 초과는 우수. 버핏이 가장 중시하는 수익성 지표.',
  PER: 'Price-to-Earnings Ratio. 주가 ÷ 주당순이익. 10 미만은 저평가.',
  PBR: 'Price-to-Book Ratio. 주가 ÷ 주당순자산. 1 미만은 청산가치 이하.',
  EPS: 'Earnings Per Share. 주당 순이익. 분기별 증가율(YoY)이 오닐 CAN SLIM의 C.',
  '부채비율': '부채총계 ÷ 자기자본 × 100. 80% 미만은 재무 안전. 버핏 보수 기준.',
  '배당률': '배당금 ÷ 주가. 3% 초과는 양호. 한국형 버핏 기준.',
}


/**
 * 지표 라벨에 hover 툴팁 설명을 붙인다.
 * 밑줄 점선 스타일로 "클릭 가능한 도움말"임을 시각적으로 표시.
 */
export function IndicatorHint({
  hintKey,
  children,
  className,
}: {
  hintKey: keyof typeof INDICATOR_HINTS | string
  children: ReactNode
  className?: string
}) {
  const hint = INDICATOR_HINTS[hintKey]
  if (!hint) return <>{children}</>

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 ${
              className ?? ''
            }`}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs"
          style={{ background: 'rgb(20, 25, 45)', color: 'rgb(230, 234, 245)', border: '1px solid rgb(42, 46, 55)' }}
        >
          <p className="text-xs font-sans leading-relaxed">{hint}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
