'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Stock } from '@/stores/stock-store'

/**
 * 티커 바 표시 모드.
 * - favorites: 사용자가 등록한 관심종목
 * - top-market-cap: 시가총액 TOP N
 * - index: 지수 구성종목 (KPI200 등)
 */
export type TickerMode = 'favorites' | 'top-market-cap' | 'index'

export interface TickerModeConfig {
  mode: TickerMode
  /** top-market-cap 모드 세부 설정 */
  market: 'KOSPI' | 'KOSDAQ'
  /** index 모드 세부 설정 */
  indexCode: 'KPI200' | 'KPI100' | 'KOSDAQ150'
  /** 상위 몇 개를 가져올지 */
  limit: number
}

interface WatchlistStore {
  /** 관심종목 목록 (모드 = 'favorites' 일 때만 사용) */
  favorites: Stock[]
  /** 티커 바 모드/설정 */
  config: TickerModeConfig
  addFavorite: (stock: Stock) => void
  removeFavorite: (symbol: string) => void
  toggleFavorite: (stock: Stock) => void
  isFavorite: (symbol: string) => boolean
  setMode: (mode: TickerMode) => void
  setMarket: (market: 'KOSPI' | 'KOSDAQ') => void
  setIndexCode: (indexCode: TickerModeConfig['indexCode']) => void
  setLimit: (limit: number) => void
}

const DEFAULT_FAVORITES: Stock[] = [
  { symbol: '005930', name: '삼성전자', market: 'KOSPI', sector: '반도체/전자' },
  { symbol: '000660', name: 'SK하이닉스', market: 'KOSPI', sector: '반도체' },
  { symbol: '035420', name: 'NAVER', market: 'KOSPI', sector: 'IT/플랫폼' },
]

const DEFAULT_CONFIG: TickerModeConfig = {
  mode: 'top-market-cap',
  market: 'KOSPI',
  indexCode: 'KPI200',
  limit: 10,
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      favorites: DEFAULT_FAVORITES,
      config: DEFAULT_CONFIG,

      addFavorite: (stock) => {
        const { favorites } = get()
        if (favorites.some((s) => s.symbol === stock.symbol)) return
        set({ favorites: [...favorites, stock] })
      },

      removeFavorite: (symbol) => {
        set({ favorites: get().favorites.filter((s) => s.symbol !== symbol) })
      },

      toggleFavorite: (stock) => {
        const { favorites } = get()
        const exists = favorites.some((s) => s.symbol === stock.symbol)
        if (exists) {
          set({ favorites: favorites.filter((s) => s.symbol !== stock.symbol) })
        } else {
          set({ favorites: [...favorites, stock] })
        }
      },

      isFavorite: (symbol) =>
        get().favorites.some((s) => s.symbol === symbol),

      setMode: (mode) => set({ config: { ...get().config, mode } }),
      setMarket: (market) => set({ config: { ...get().config, market } }),
      setIndexCode: (indexCode) =>
        set({ config: { ...get().config, indexCode } }),
      setLimit: (limit) => set({ config: { ...get().config, limit } }),
    }),
    {
      name: 'stock-war-room:watchlist',
      version: 1,
    },
  ),
)
