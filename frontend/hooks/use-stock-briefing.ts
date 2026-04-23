'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface Briefing {
  symbol: string
  stock_name: string
  message: string
  signal_type: 'BUY' | 'SELL' | 'HOLD'
  momentum: number
  target_price: number | null
}

/**
 * Claude 가 생성한 AI 브리핑 메시지.
 */
export function useStockBriefing(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['stock-briefing', symbol],
    queryFn: () => apiGet<Briefing>(`/stocks/${symbol}/briefing`),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000,
    retry: false, // LLM 호출 실패 시 재시도하지 않음 (비용 고려)
  })
}
