'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface MacroIndicator {
  code: string
  label: string
  value: number
  change: number
  change_pct: number
}

export interface MacroSnapshot {
  indicators: MacroIndicator[]
  risk_level: 'low' | 'mid' | 'high'
  risk_summary: string
  fetched_at: string
}

/**
 * 거시경제 스냅샷 (USD/KRW, KOSPI, VIX, WTI, 공포·탐욕).
 * 백엔드 in-memory 캐시 5분. 프론트 staleTime 도 5분으로 맞춤.
 */
export function useMacroSnapshot() {
  return useQuery({
    queryKey: ['macro-snapshot'],
    queryFn: () => apiGet<MacroSnapshot>('/macro/snapshot'),
    staleTime: 5 * 60_000,
  })
}
