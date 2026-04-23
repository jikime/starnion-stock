'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { Stock } from '@/stores/stock-store'

/**
 * 시가총액 TOP N 종목 (네이버 금융 랭킹 페이지 기반).
 */
export function useTopMarketCap(
  market: 'KOSPI' | 'KOSDAQ' = 'KOSPI',
  limit = 10,
) {
  return useQuery({
    queryKey: ['market-top', market, limit],
    queryFn: () =>
      apiGet<Stock[]>(
        `/market/top-market-cap?market=${market}&limit=${limit}`,
      ),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
}

/**
 * 지수 구성종목 (KPI200 등 네이버 금융 구성종목 페이지 기반).
 */
export function useIndexConstituents(
  indexCode: string = 'KPI200',
  limit = 30,
) {
  return useQuery({
    queryKey: ['index-constituents', indexCode, limit],
    queryFn: () =>
      apiGet<Stock[]>(
        `/market/index-constituents?index_code=${indexCode}&limit=${limit}`,
      ),
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
  })
}
