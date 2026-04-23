'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Star, TrendingUp, BarChart3, Check } from 'lucide-react'
import {
  useWatchlistStore,
  type TickerMode,
  type TickerModeConfig,
} from '@/stores/watchlist-store'

const MODE_LABEL: Record<TickerMode, string> = {
  favorites: '관심종목',
  'top-market-cap': '시가총액 TOP',
  index: '지수 구성',
}

const MODE_ICON: Record<TickerMode, typeof Star> = {
  favorites: Star,
  'top-market-cap': TrendingUp,
  index: BarChart3,
}

const INDEX_OPTIONS: {
  value: TickerModeConfig['indexCode']
  label: string
}[] = [
  { value: 'KPI200', label: '코스피 200' },
  { value: 'KPI100', label: '코스피 100' },
  { value: 'KOSDAQ150', label: '코스닥 150' },
]

export function TickerModeSwitcher() {
  const config = useWatchlistStore((s) => s.config)
  const setMode = useWatchlistStore((s) => s.setMode)
  const setMarket = useWatchlistStore((s) => s.setMarket)
  const setIndexCode = useWatchlistStore((s) => s.setIndexCode)
  const setLimit = useWatchlistStore((s) => s.setLimit)
  const favoritesCount = useWatchlistStore((s) => s.favorites.length)

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const ActiveIcon = MODE_ICON[config.mode]

  const summary = (() => {
    if (config.mode === 'favorites') return `관심 ${favoritesCount}`
    if (config.mode === 'top-market-cap')
      return `${config.market} TOP ${config.limit}`
    return config.indexCode
  })()

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border transition-colors ${
          open
            ? 'bg-primary/10 border-primary/50 text-primary'
            : 'bg-surface-raised border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
        }`}
        aria-label="티커 모드 변경"
      >
        <ActiveIcon size={12} />
        <span className="text-[10px] font-mono font-semibold">{summary}</span>
        <ChevronDown
          size={10}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-[200] w-64 glass-card rounded-lg border border-border overflow-hidden shadow-2xl">
          <div className="px-3 py-2 border-b border-border/50">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              티커 모드
            </span>
          </div>

          {/* 모드 선택 */}
          <div className="p-1.5 space-y-0.5">
            {(['favorites', 'top-market-cap', 'index'] as TickerMode[]).map(
              (m) => {
                const Icon = MODE_ICON[m]
                const active = config.mode === m
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors ${
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon size={12} />
                    <span className="flex-1 text-xs font-mono">
                      {MODE_LABEL[m]}
                    </span>
                    {active && <Check size={12} />}
                  </button>
                )
              },
            )}
          </div>

          {/* 시가총액 모드: 시장 선택 */}
          {config.mode === 'top-market-cap' && (
            <div className="border-t border-border/50 px-3 py-2 space-y-2">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                시장
              </div>
              <div className="flex gap-1">
                {(['KOSPI', 'KOSDAQ'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMarket(m)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                      config.market === m
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 지수 모드: 지수 선택 */}
          {config.mode === 'index' && (
            <div className="border-t border-border/50 px-3 py-2 space-y-2">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                지수
              </div>
              <div className="space-y-0.5">
                {INDEX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIndexCode(opt.value)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-mono border transition-colors ${
                      config.indexCode === opt.value
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="opacity-60">{opt.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 개수 선택 (favorites 제외) */}
          {config.mode !== 'favorites' && (
            <div className="border-t border-border/50 px-3 py-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                  상위
                </span>
                <span className="text-[10px] font-mono text-foreground">
                  {config.limit}개
                </span>
              </div>
              <div className="flex gap-1">
                {[5, 10, 20, 30, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLimit(n)}
                    className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                      config.limit === n
                        ? 'bg-primary/15 border-primary/40 text-primary'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.mode === 'favorites' && favoritesCount === 0 && (
            <div className="border-t border-border/50 px-3 py-3">
              <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                관심종목이 없습니다. 검색창에서 종목을 찾아 ★ 아이콘을
                눌러 등록하세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
