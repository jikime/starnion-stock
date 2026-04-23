'use client'

import { create } from 'zustand'

export interface Stock {
  symbol: string
  name: string
  market: string
  sector: string
}

interface StockStore {
  selected: Stock | null
  setSelected: (stock: Stock) => void
}

/**
 * 선택된 종목을 전역 상태로 관리.
 * 기존 React Context (stock-context.tsx) 를 Zustand 로 대체.
 */
export const useStockStore = create<StockStore>((set) => ({
  selected: null,
  setSelected: (stock) => set({ selected: stock }),
}))
