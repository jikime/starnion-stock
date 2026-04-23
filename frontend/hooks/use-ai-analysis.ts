'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'

export interface AIAnalysis {
  id: string
  symbol: string
  stock_name: string
  decision: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  summary: string
  reasoning: string
  positives: string[]
  risks: string[]
  target_price: number | null
  rsi: number | null
  macd_state: 'golden' | 'dead' | 'neutral' | null
  news_count: number
  price_at_analysis: number | null
  created_at: string | null
}

const historyKey = (symbol: string | null | undefined) => [
  'ai-analysis-history',
  symbol,
]

/** 저장된 AI 분석 이력 조회 */
export function useAIAnalysisHistory(
  symbol: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: historyKey(symbol),
    queryFn: () =>
      apiGet<AIAnalysis[]>(`/stocks/${symbol}/ai-analysis/history`),
    enabled: enabled && Boolean(symbol),
    staleTime: 5 * 60_000,
  })
}

/** Claude 심층 분석 요청 (POST) */
export function useGenerateAIAnalysis(symbol: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiPost<AIAnalysis>(`/stocks/${symbol}/ai-analysis`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: historyKey(symbol) })
    },
  })
}

/** 저장된 AI 분석 삭제 */
export function useDeleteAIAnalysis(symbol: string | null | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/ai-analysis/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: historyKey(symbol) })
    },
  })
}
