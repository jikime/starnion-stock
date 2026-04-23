'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface PriceLevel {
  price: number
  kind: 'support' | 'resistance'
  touch_count: number
  strength: number
  explanation: string
}

export interface PriceLevelsSnapshot {
  symbol: string
  current_price: number
  levels: PriceLevel[]
  computed_at: string
}

/**
 * AI 하이브리드 지지/저항 레벨 — 스윙 포인트 + 클러스터링 알고리즘으로
 * 후보를 뽑고 Claude 가 각 레벨에 한 문장 해설을 붙인 결과.
 *
 * 백엔드 캐시 TTL 30분. 프론트는 2분 정도만 살아있게 두고 종목 전환 시
 * 새 요청이 나가도록 한다.
 */
export function useStockLevels(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['stock-levels', symbol],
    queryFn: () =>
      apiGet<PriceLevelsSnapshot>(`/stocks/${symbol}/levels`),
    enabled: Boolean(symbol),
    staleTime: 2 * 60_000,
  })
}
