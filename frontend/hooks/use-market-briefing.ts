'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface MarketBriefing {
  date: string              // YYYY-MM-DD
  headline: string          // 한 줄 요약
  weather: '맑음' | '흐림' | '비' | string
  briefing: string          // 3~4문장 본문
  sectors_strong: string[]
  sectors_weak: string[]
  computed_at: string | null
}

/**
 * 오늘의 AI 시장 브리핑.
 * 백엔드는 1일 1회 Claude 로 생성 후 SQLite 캐시 → 여러 번 호출해도 동일.
 * 프론트 staleTime 1시간.
 */
export function useMarketBriefing() {
  return useQuery({
    queryKey: ['market-briefing'],
    queryFn: () => apiGet<MarketBriefing>('/market/briefing'),
    staleTime: 60 * 60_000,
  })
}
