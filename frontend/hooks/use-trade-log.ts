'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client'

export interface TradeEntry {
  id: string
  symbol: string
  name: string
  entry_price: number
  target_price: number
  stop_loss: number | null
  current_price: number | null
  qty: number
  date: string
  time: string
  status: 'open' | 'closed' | 'target'
  emotion: '확신' | '불안' | '중립' | '흥분'
  news_snapshot: string
  strategy_note: string
}

export type TradeCreate = Omit<TradeEntry, 'id'>

const KEY = ['trades']

export function useTradeLog() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<TradeEntry[]>('/trades'),
    staleTime: 30_000,
  })
}

export function useCreateTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trade: TradeCreate) => apiPost<TradeEntry>('/trades', trade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUpdateTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, trade }: { id: string; trade: TradeCreate }) =>
      apiPut<TradeEntry>(`/trades/${id}`, trade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useDeleteTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/trades/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}
