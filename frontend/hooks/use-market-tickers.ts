'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useWatchlistStore } from '@/stores/watchlist-store'
import {
  useIndexConstituents,
  useTopMarketCap,
} from '@/hooks/use-market-rank'

export interface TickerItem {
  symbol: string
  name: string
  current_price: number
  change: number
  change_pct: number
  volume: number
  updated_at: string
  price_type: 'index' | 'stock'
}

/**
 * 상단 티커 바: 시장 지수 + 선택된 모드에 따른 관심 종목 리스트.
 *
 * 모드별 symbol 결정:
 * - favorites: Zustand persisted 관심종목
 * - top-market-cap: /api/market/top-market-cap
 * - index: /api/market/index-constituents
 *
 * 결정된 symbols 로 /api/market/tickers?symbols=... 호출하여 실시간 가격을
 * 가져온다. 60초마다 자동 갱신.
 */
export function useMarketTickers() {
  const config = useWatchlistStore((s) => s.config)
  const favorites = useWatchlistStore((s) => s.favorites)

  const { data: topCap = [] } = useTopMarketCap(
    config.market,
    config.limit,
  )
  const { data: indexStocks = [] } = useIndexConstituents(
    config.indexCode,
    config.limit,
  )

  const symbols = useMemo(() => {
    if (config.mode === 'favorites') {
      return favorites.map((s) => s.symbol)
    }
    if (config.mode === 'top-market-cap') {
      return topCap.map((s) => s.symbol)
    }
    return indexStocks.map((s) => s.symbol)
  }, [config.mode, favorites, topCap, indexStocks])

  return useQuery({
    queryKey: ['market-tickers', symbols.join(',')],
    queryFn: () =>
      apiGet<TickerItem[]>(`/market/tickers?symbols=${symbols.join(',')}`),
    enabled: symbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
