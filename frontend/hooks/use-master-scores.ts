'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface MasterScore {
  name: 'buffett' | 'oneill' | 'livermore'
  label: string
  score: number
  signal: 'BUY' | 'HOLD' | 'SELL'
  reasons: string[]
}

export interface Fundamental {
  per: number | null
  eps: number | null
  pbr: number | null
  dividend_yield: number | null
  // docs/02 DART 재무비율
  roe?: number | null
  debt_ratio?: number | null
  net_profit_margin?: number | null
  revenue_growth?: number | null
  net_income_growth?: number | null
  op_income_growth?: number | null
}

export interface ForeignFlowPoint {
  date: string   // ISO YYYY-MM-DD
  net: number    // 외인 순매수 주식 수
}

export interface MasterScores {
  symbol: string
  stock_name: string
  buffett: MasterScore
  oneill: MasterScore
  livermore: MasterScore
  star_score: number
  fundamental: Fundamental
  computed_at: string
  commentary: string                    // docs/03 — 3인 매칭 해설 한 문장
  foreign_flow: ForeignFlowPoint[]      // docs/04 — 외인 5일 flow
  institution_flow: ForeignFlowPoint[]  // docs/05 — 기관 5일 flow
  volume_ratio: number | null           // docs/04 — Volume Spike
  retail_net_5d: number | null          // docs/04 — 개인 순매수 5일
  macro_notes: string[]                 // docs/09 — 매크로 컨펌 노트
}

/**
 * 거장 3인 멀티팩터 스코어 + Star Score. 백엔드 SQLite 캐시 1시간.
 */
export function useMasterScores(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['master-scores', symbol],
    queryFn: () =>
      apiGet<MasterScores>(`/stocks/${symbol}/master-scores`),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000, // 장중 백엔드 TTL 5분에 맞춤
  })
}
