'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface SectorRank {
  name: string
  change_pct: number
  total_count: number
  up_count: number
  down_count: number
  flat_count: number
}

/**
 * 네이버 업종별 등락률 — 5분 캐시.
 */
export function useSectors() {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: () => apiGet<SectorRank[]>('/market/sectors'),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}
