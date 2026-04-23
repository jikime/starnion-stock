'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * OHLCV 캔들 데이터 쿼리. 백엔드 pykrx 로부터 수신.
 */
export function useStockCandles(
  symbol: string | null | undefined,
  period = 'day',
  count = 120,
) {
  return useQuery({
    queryKey: ['stock-candles', symbol, period, count],
    queryFn: () =>
      apiGet<Candle[]>(
        `/stocks/${symbol}/candles?period=${period}&count=${count}`,
      ),
    enabled: Boolean(symbol),
    staleTime: 60_000,
  })
}
