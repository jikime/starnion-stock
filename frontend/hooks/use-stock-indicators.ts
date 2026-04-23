'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface Indicators {
  rsi14: number | null
  macd: number | null
  macd_signal: number | null
  macd_hist: number | null
  bb_upper: number | null
  bb_middle: number | null
  bb_lower: number | null
  sma5: number | null
  sma20: number | null
  sma60: number | null
  sma120: number | null
  stoch_k: number | null
  stoch_d: number | null
  williams_r: number | null
  cci: number | null
  adx: number | null
}

/**
 * 기술적 지표 전체 (RSI/MACD/BB/SMA/Stoch/Williams %R/CCI/ADX).
 * 백엔드 pandas-ta 기반 ``/api/stocks/{symbol}/indicators`` 호출.
 */
export function useStockIndicators(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['stock-indicators', symbol],
    queryFn: () => apiGet<Indicators>(`/stocks/${symbol}/indicators`),
    enabled: Boolean(symbol),
    staleTime: 60_000,
  })
}
