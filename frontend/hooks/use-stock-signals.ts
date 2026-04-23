'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface StockSignal {
  symbol: string
  type: 'STRONG_BUY' | 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  momentum: number
  step1_technical: boolean
  step2_sentiment: boolean
  // docs/01 — 3개 매수 타점 condition breakdown
  cond_rsi_bb?: boolean
  cond_trend_pullback?: boolean
  cond_vwap_volume?: boolean
  cond_supply?: boolean
  // 복합 점수 (기술 40 + 수급 30 + 뉴스 20 + 심리 10)
  score_tech?: number
  score_supply?: number
  score_news?: number
  score_psych?: number
  target_price: number | null
  reasons: string[]
  // docs/01 #4 — AI 자동 컨펌 (STRONG_BUY 시에만 Claude 호출)
  ai_confirmation?: string | null
  ai_verdict?: 'CONFIRM' | 'CAUTION' | 'REJECT' | null
}

export interface MomentumScore {
  symbol: string
  score: number
}

/**
 * AI 시그널 종합 (Step1 기술+Step2 감성 판정 결과).
 */
export function useStockSignals(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['stock-signals', symbol],
    queryFn: () => apiGet<StockSignal>(`/stocks/${symbol}/signals`),
    enabled: Boolean(symbol),
    staleTime: 2 * 60_000,
  })
}

export function useMomentumScore(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['momentum', symbol],
    queryFn: () => apiGet<MomentumScore>(`/stocks/${symbol}/momentum`),
    enabled: Boolean(symbol),
    staleTime: 2 * 60_000,
  })
}
