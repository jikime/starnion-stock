'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export type HotMetric = 'value' | 'volume' | 'change' | 'fall'

export interface HotStockRow {
  rank: number
  symbol: string
  name: string
  price: number
  change: number
  change_pct: number
  volume: number
  trade_value: number
}

/**
 * 네이버 인기 랭킹 — 거래대금/거래량/상승률/하락률.
 * 2분 staleTime + 2분 자동 갱신.
 */
export function useHotStocks(
  metric: HotMetric = 'value',
  market: 'KOSPI' | 'KOSDAQ' = 'KOSPI',
  limit: number = 20,
) {
  return useQuery({
    queryKey: ['hot-stocks', metric, market, limit],
    queryFn: () =>
      apiGet<HotStockRow[]>(
        `/market/hot-stocks?metric=${metric}&market=${market}&limit=${limit}`,
      ),
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  })
}
