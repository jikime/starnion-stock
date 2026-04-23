'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface ExitSignal {
  name: 'stoploss' | 'trend' | 'overheat' | 'target'
  label: string
  triggered: boolean
  detail: string
}

export interface MasterExitOpinion {
  name: string
  label: string
  decision: 'HOLD' | 'SELL'
  reason: string
}

export interface ExitSimulation {
  symbol: string
  entry_price: number
  current_price: number
  pnl: number
  pnl_pct: number
  urgency_score: number
  recommendation: 'HOLD' | 'WATCH' | 'SELL'
  signals: ExitSignal[]
  master_opinions: MasterExitOpinion[]
}

/**
 * 매도 시뮬레이터 — 4단계 시그널 + 거장 3인 결정.
 * staleTime 짧게 (30초) — 가격 변동에 민감.
 */
export function useExitSimulation(
  symbol: string | null | undefined,
  entryPrice: number | null,
  entryDate?: string | null,
  customStoploss?: number | null,
  customTarget?: number | null,
) {
  return useQuery({
    queryKey: ['exit-simulation', symbol, entryPrice, entryDate, customStoploss, customTarget],
    queryFn: () => {
      let url = `/stocks/${symbol}/exit-simulation?entry_price=${entryPrice}`
      if (entryDate) url += `&entry_date=${entryDate}`
      if (customStoploss != null) url += `&stoploss_pct=${customStoploss}`
      if (customTarget != null) url += `&target_pct=${customTarget}`
      return apiGet<ExitSimulation>(url)
    },
    enabled: Boolean(symbol) && typeof entryPrice === 'number' && entryPrice > 0,
    staleTime: 30_000,
  })
}
