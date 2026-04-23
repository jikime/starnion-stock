'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStockStore } from '@/stores/stock-store'

/**
 * 메인 페이지 → 워룸 리다이렉트.
 *
 * 최근 선택 종목이 있으면 /stock/[symbol]로 이동.
 * 없으면 기본값 코스피(KOSPI)로 진입.
 */

const DEFAULT_STOCK = {
  symbol: '005930',
  name: '삼성전자',
  market: 'KOSPI' as const,
  sector: '전기전자',
}

export default function MainPage() {
  const router = useRouter()
  const selected = useStockStore((s) => s.selected)
  const setSelected = useStockStore((s) => s.setSelected)

  useEffect(() => {
    if (selected?.symbol) {
      router.replace(`/stock/${selected.symbol}`)
    } else {
      setSelected(DEFAULT_STOCK)
      router.replace(`/stock/${DEFAULT_STOCK.symbol}`)
    }
  }, [selected, setSelected, router])

  return null
}
