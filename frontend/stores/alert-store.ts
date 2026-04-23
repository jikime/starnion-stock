'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PriceAlert {
  id: string
  symbol: string
  stockName: string
  targetPrice: number
  direction: 'above' | 'below'   // 현재가가 이 가격 위로/아래로 갔을 때 트리거
  createdAt: number              // Date.now()
  triggered: boolean             // 한 번 트리거되면 다시 울리지 않음
  triggeredAt?: number
}

interface AlertStore {
  alerts: PriceAlert[]
  addAlert: (input: {
    symbol: string
    stockName: string
    targetPrice: number
    direction: 'above' | 'below'
  }) => void
  removeAlert: (id: string) => void
  markTriggered: (id: string) => void
  clearAll: () => void
}

export const useAlertStore = create<AlertStore>()(
  persist(
    (set, get) => ({
      alerts: [],

      addAlert: ({ symbol, stockName, targetPrice, direction }) => {
        const newAlert: PriceAlert = {
          id: `${symbol}-${direction}-${targetPrice}-${Date.now()}`,
          symbol,
          stockName,
          targetPrice,
          direction,
          createdAt: Date.now(),
          triggered: false,
        }
        set({ alerts: [...get().alerts, newAlert] })
      },

      removeAlert: (id) => {
        set({ alerts: get().alerts.filter((a) => a.id !== id) })
      },

      markTriggered: (id) => {
        set({
          alerts: get().alerts.map((a) =>
            a.id === id ? { ...a, triggered: true, triggeredAt: Date.now() } : a,
          ),
        })
      },

      clearAll: () => set({ alerts: [] }),
    }),
    {
      name: 'stock-war-room:alerts',
      version: 1,
    },
  ),
)
