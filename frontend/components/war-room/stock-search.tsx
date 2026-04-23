'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Info, Search, Star, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useStockStore, type Stock } from '@/stores/stock-store'
import { useWatchlistStore } from '@/stores/watchlist-store'
import { useAllStocks, useStockList } from '@/hooks/use-stock-list'

const MARKET_LABEL: Record<string, string> = {
  KOSPI: '코스피',
  KOSDAQ: '코스닥',
  KONEX: '코넥스',
}

/**
 * 검색어와 매칭되는 부분을 primary 색상으로 하이라이트.
 * 띄어쓰기 무시 매칭은 UI 렌더 단계에서 정확 위치를 찾기 어렵기 때문에
 * 소문자 substring 매칭 기준만 지원.
 */
function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>

  const lower = text.toLowerCase()
  const start = lower.indexOf(q)
  if (start === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, start)}
      <span className="text-primary font-bold">
        {text.slice(start, start + q.length)}
      </span>
      {text.slice(start + q.length)}
    </>
  )
}

export function StockSearch() {
  const router = useRouter()
  const selected = useStockStore((s) => s.selected)
  const setSelected = useStockStore((s) => s.setSelected)
  const isFavorite = useWatchlistStore((s) => s.isFavorite)
  const toggleFavorite = useWatchlistStore((s) => s.toggleFavorite)

  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const { data: allStocks = [], isLoading: loadingAll } = useAllStocks()
  const { data: results } = useStockList(query, 30)

  const showPopover = expanded && query.trim().length > 0

  // 초기 선택 종목 자동 설정: 삼성전자(005930) 우선, 없으면 목록 첫 종목
  useEffect(() => {
    if (!selected && allStocks.length > 0) {
      const defaultStock =
        allStocks.find((s) => s.symbol === '005930') ?? allStocks[0]
      setSelected(defaultStock)
    }
  }, [selected, allStocks, setSelected])

  const collapseAndReset = useCallback(() => {
    setExpanded(false)
    setQuery('')
    setHighlighted(0)
  }, [])

  const handleSelect = useCallback(
    (stock: Stock) => {
      setSelected(stock)
      collapseAndReset()
      inputRef.current?.blur()
      // 대시보드/다른 페이지에서 검색한 경우 워룸으로 이동. 이미 워룸이면
      // URL 만 해당 종목으로 바꾸기 (shallow 동작).
      router.push(`/stock/${stock.symbol}`)
    },
    [setSelected, collapseAndReset, router],
  )

  const handleOpen = useCallback(() => {
    setExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Cmd/Ctrl+K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleOpen()
      }
      if (e.key === 'Escape' && expanded) {
        collapseAndReset()
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded, handleOpen, collapseAndReset])

  useEffect(() => {
    setHighlighted(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && showPopover && results[highlighted]) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      collapseAndReset()
      inputRef.current?.blur()
    }
  }

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        collapseAndReset()
      }
    }
    if (expanded) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded, collapseAndReset])

  // 하이라이트 자동 스크롤
  useEffect(() => {
    if (!showPopover || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${highlighted}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, showPopover])

  const totalCount = allStocks.length

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* 접힘: 선택 종목 요약 버튼 */}
      {!expanded && (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 h-7 px-3 rounded-lg bg-surface-raised border border-border hover:border-primary/50 transition-colors group"
          aria-label="종목 검색 열기"
        >
          <Search
            size={12}
            className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
          />
          <span className="text-foreground font-mono text-xs font-semibold">
            {selected?.name ?? '종목 선택'}
          </span>
          <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
            {selected?.symbol ?? '—'}
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 rounded text-[9px] font-mono text-muted-foreground border border-border ml-1">
            ⌘K
          </kbd>
        </button>
      )}

      {/* 펼침: 큰 검색 입력 폼 (이미지 레이아웃 기준) */}
      {expanded && (
        <div
          className="flex items-center h-9 w-[420px] rounded-lg bg-surface-raised border-2 border-primary/70 ring-1 ring-primary/20"
          role="combobox"
          aria-expanded={showPopover}
          aria-controls="stock-search-listbox"
          aria-haspopup="listbox"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="종목명 또는 종목코드"
            className="flex-1 h-full px-4 bg-transparent text-foreground text-sm font-mono outline-none placeholder:text-muted-foreground/60"
            aria-label="종목 검색 입력"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="px-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="검색어 지우기"
            >
              <X size={14} />
            </button>
          )}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={collapseAndReset}
            className="px-3 h-full flex items-center border-l border-border/60 text-primary hover:bg-primary/10 transition-colors rounded-r-md"
            aria-label="검색 닫기"
          >
            <Search size={16} />
          </button>
        </div>
      )}

      {/* Autocomplete Popover (타이핑 시에만 표시) */}
      {showPopover && (
        <div className="absolute top-full left-0 mt-1.5 z-[200] w-[420px] glass-card rounded-lg border border-border overflow-hidden shadow-2xl">
          <ul
            ref={listRef}
            id="stock-search-listbox"
            className="max-h-80 overflow-y-auto hide-scrollbar"
            role="listbox"
            aria-label="종목 검색 결과"
          >
            {results.length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
                {loadingAll && allStocks.length === 0
                  ? '종목 목록 로딩 중...'
                  : `"${query}" 검색 결과가 없습니다`}
              </li>
            ) : (
              results.map((stock, i) => {
                const active = i === highlighted
                const isCurrent = stock.symbol === selected?.symbol
                const marketLabel = MARKET_LABEL[stock.market] ?? stock.market
                const favorited = isFavorite(stock.symbol)
                return (
                  <li
                    key={stock.symbol}
                    data-idx={i}
                    role="option"
                    aria-selected={active}
                    className={`relative flex items-center gap-3 pr-2 transition-colors ${
                      active ? 'bg-muted/60' : 'hover:bg-muted/30'
                    } ${
                      isCurrent
                        ? 'border-l-2 border-primary'
                        : 'border-l-2 border-transparent'
                    }`}
                    onMouseEnter={() => setHighlighted(i)}
                  >
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(stock)}
                      className="flex-1 flex items-center gap-4 px-4 py-2.5 text-left"
                    >
                      {/* 종목코드 */}
                      <span className="w-16 shrink-0 text-xs font-mono text-muted-foreground tabular-nums">
                        <HighlightedText
                          text={stock.symbol}
                          query={query}
                        />
                      </span>

                      {/* 종목명 */}
                      <span
                        className={`flex-1 min-w-0 truncate text-sm font-mono ${
                          isCurrent ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        <HighlightedText text={stock.name} query={query} />
                      </span>

                      {/* 시장 구분 */}
                      <span className="shrink-0 text-xs font-mono text-muted-foreground">
                        {marketLabel}
                      </span>
                    </button>

                    {/* 즐겨찾기 토글 */}
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(stock)
                      }}
                      className={`shrink-0 p-1.5 rounded transition-colors ${
                        favorited
                          ? 'text-primary hover:text-primary/80'
                          : 'text-muted-foreground/50 hover:text-primary'
                      }`}
                      aria-label={
                        favorited ? '관심종목에서 제거' : '관심종목에 추가'
                      }
                      title={
                        favorited ? '관심종목에서 제거' : '관심종목에 추가'
                      }
                    >
                      <Star
                        size={14}
                        fill={favorited ? 'currentColor' : 'none'}
                      />
                    </button>
                  </li>
                )
              })
            )}
          </ul>

          {/* 하단 안내 */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/20">
            <Info size={11} className="text-muted-foreground shrink-0" />
            <span className="text-[10px] font-mono text-muted-foreground">
              KRX 상장 종목 {totalCount.toLocaleString()}개 중에서 검색합니다. ↑↓
              이동 · Enter 선택 · Esc 닫기
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
