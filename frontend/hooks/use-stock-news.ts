'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

export type Sentiment = 'pos' | 'neg' | 'neu'
export type Impact = 'Critical' | 'High' | 'Moderate'

export interface NewsItem {
  id: string
  symbol: string
  headline: string
  source: string
  url: string
  sentiment: Sentiment
  impact: Impact
  keywords: string[]
  ai_summary: string
  published_at: string | null
  hour: number
}

export interface SentimentHeatmapBin {
  hour: number
  positive: number
  negative: number
  neutral: number
}

export interface TrendingKeyword {
  text: string
  weight: 'high' | 'mid' | 'low'
  sentiment: Sentiment
}

/**
 * 네이버 금융 뉴스 + 키워드 기반 감성 분류 결과.
 */
export function useStockNews(
  symbol: string | null | undefined,
  limit = 10,
) {
  return useQuery({
    queryKey: ['stock-news', symbol, limit],
    queryFn: () =>
      apiGet<NewsItem[]>(`/stocks/${symbol}/news?limit=${limit}`),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000,
  })
}

export function useStockSentimentHeatmap(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['stock-sentiment', symbol],
    queryFn: () =>
      apiGet<SentimentHeatmapBin[]>(`/stocks/${symbol}/sentiment`),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000,
  })
}

export function useTrendingKeywords(symbol: string | null | undefined) {
  return useQuery({
    queryKey: ['trending-keywords', symbol],
    queryFn: () =>
      apiGet<TrendingKeyword[]>(
        `/keywords/trending?symbol=${symbol}`,
      ),
    enabled: Boolean(symbol),
    staleTime: 5 * 60_000,
  })
}
