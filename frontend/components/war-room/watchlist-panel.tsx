'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Star, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useWatchlistStore } from '@/stores/watchlist-store'
import { useStockStore, type Stock } from '@/stores/stock-store'
import { apiGet } from '@/lib/api-client'
import type { TickerItem } from '@/hooks/use-market-tickers'

/**
 * 관심종목 패널 — 사이드바 레일에서 열리는 관심종목 리스트.
 *
 * 관심종목 심볼 전용으로 /api/market/tickers 를 호출하여 실시간 가격 표시.
 * 레이아웃: 좌측 (종목명+코드) | 우측 (현재가+변동)
 */
export function WatchlistPanel() {
  const router = useRouter()
  const favorites = useWatchlistStore((s) => s.favorites)
  const removeFavorite = useWatchlistStore((s) => s.removeFavorite)
  const setSelected = useStockStore((s) => s.setSelected)
  const selected = useStockStore((s) => s.selected)

  // 관심종목 전용 실시간 가격 조회
  const favSymbols = favorites.map((s) => s.symbol).join(',')
  const { data: tickers = [] } = useQuery({
    queryKey: ['watchlist-tickers', favSymbols],
    queryFn: () =>
      apiGet<TickerItem[]>(`/market/tickers?symbols=${favSymbols}`),
    enabled: favSymbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const priceMap = useMemo(
    () => new Map(tickers.map((t) => [t.symbol, t])),
    [tickers],
  )

  const handleClick = useCallback(
    (stock: Stock) => {
      setSelected(stock)
      router.push(`/stock/${stock.symbol}`)
    },
    [setSelected, router],
  )

  return (
    <div className="glass-card rounded-xl border border-border h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Star size={12} className="text-primary" />
          관심종목
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {favorites.length}개
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        {favorites.length === 0 ? (
          <div className="p-4 text-center">
            <Star size={24} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              관심종목이 없습니다.
              <br />
              Cmd+K 검색 후 별 아이콘으로 추가하세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {favorites.map((stock) => {
              const ticker = priceMap.get(stock.symbol)
              const isUp = ticker ? ticker.change >= 0 : false
              const isCurrent = selected?.symbol === stock.symbol
              return (
                <li
                  key={stock.symbol}
                  className={`group relative flex items-stretch transition-colors ${
                    isCurrent
                      ? 'bg-primary/5 border-l-2 border-primary'
                      : 'border-l-2 border-transparent hover:bg-muted/30'
                  }`}
                >
                  <button
                    onClick={() => handleClick(stock)}
                    className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    {/* 좌: 종목명 + 코드 */}
                    <div className="min-w-0 shrink-0">
                      <div
                        className={`text-sm font-display font-bold truncate ${
                          isCurrent ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {stock.name}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground tabular-nums">
                        {stock.symbol}
                      </div>
                    </div>

                    {/* 우: 현재가 + 변동금액/변동률 */}
                    {ticker ? (
                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-mono font-bold tabular-nums ${
                            isUp ? 'text-bull' : 'text-bear'
                          }`}
                        >
                          {Math.round(ticker.current_price).toLocaleString(
                            'ko-KR',
                          )}
                        </div>
                        <div
                          className={`flex items-center justify-end gap-0.5 text-[10px] font-mono tabular-nums ${
                            isUp ? 'text-bull' : 'text-bear'
                          }`}
                        >
                          {isUp ? (
                            <TrendingUp size={9} />
                          ) : (
                            <TrendingDown size={9} />
                          )}
                          {isUp ? '+' : ''}
                          {Math.round(ticker.change).toLocaleString('ko-KR')}{' '}
                          ({isUp ? '+' : ''}
                          {ticker.change_pct.toFixed(2)}%)
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        —
                      </span>
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFavorite(stock.symbol)
                    }}
                    className="shrink-0 px-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-bear transition-all"
                    aria-label="관심종목에서 제거"
                    title="관심종목에서 제거"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
