'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { Stock } from '@/stores/stock-store'

const ALL_STOCKS_KEY = ['stock-list-all']
const ALL_STOCKS_URL = '/stocks'

/**
 * 전체 KOSPI/KOSDAQ 상장 종목 목록 (~2,658개).
 * 백엔드가 KRX 공식 corpList 에서 한 번 다운로드 후 24h 디스크 캐시한다.
 * 프론트에서는 5분간 캐시 후 재조회.
 */
export function useAllStocks() {
  return useQuery({
    queryKey: ALL_STOCKS_KEY,
    queryFn: () => apiGet<Stock[]>(ALL_STOCKS_URL),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}

/**
 * 클라이언트 사이드 검색 훅. 전체 목록을 한 번만 가져오고, 메모리에서
 * 쿼리를 필터링하여 즉시 자동완성 결과를 반환한다.
 */
export function useStockList(query: string, limit = 20) {
  const { data: allStocks = [], isLoading } = useAllStocks()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // 입력이 없으면 앞에서 limit 개 (KOSPI 우량주 우선)
      return allStocks.slice(0, limit)
    }
    const qNoSpace = q.replace(/\s/g, '')

    // 우선순위 계산: 정확 일치 → 시작 일치 → 부분 일치
    const scored = allStocks
      .map((s) => {
        const name = s.name.toLowerCase()
        const nameNoSpace = name.replace(/\s/g, '')
        const symbol = s.symbol.toLowerCase()
        const sector = s.sector.toLowerCase()

        let score = 0
        if (symbol === q || name === q || nameNoSpace === qNoSpace) score = 100
        else if (symbol.startsWith(q)) score = 90
        else if (name.startsWith(q) || nameNoSpace.startsWith(qNoSpace)) score = 80
        else if (symbol.includes(q)) score = 60
        else if (name.includes(q) || nameNoSpace.includes(qNoSpace)) score = 50
        else if (sector.includes(q)) score = 20
        return { stock: s, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map((x) => x.stock)
  }, [allStocks, query, limit])

  return {
    data: results,
    isLoading,
  }
}
