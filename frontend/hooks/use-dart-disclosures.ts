'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface Disclosure {
  rcept_no: string
  corp_code: string
  corp_name: string
  report_nm: string
  rcept_dt: string
  category: string
  summary: string
  url: string
}

/**
 * DART 공시 목록 조회 (최근 30일).
 */
export function useDartDisclosures(
  symbol: string | null | undefined,
  days = 30,
) {
  return useQuery({
    queryKey: ['dart-disclosures', symbol, days],
    queryFn: () =>
      apiGet<Disclosure[]>(
        `/stocks/${symbol}/disclosures?days=${days}`,
      ),
    enabled: Boolean(symbol),
    staleTime: 60 * 60_000, // 1시간
  })
}
