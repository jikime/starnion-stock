'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, TrendingDown, TrendingUp } from 'lucide-react'
import { StockSearch } from './stock-search'
import { TickerModeSwitcher } from './ticker-mode-switcher'
import { useMarketTickers, type TickerItem } from '@/hooks/use-market-tickers'
import { useMacroSnapshot } from '@/hooks/use-macro-snapshot'
import { useStockStore } from '@/stores/stock-store'

const WEATHER_ICON: Record<string, string> = {
  low: '\u2600\uFE0F',   // ☀️
  mid: '\u26C5',         // ⛅
  high: '\u26C8\uFE0F',  // ⛈️
}
const WEATHER_LABEL: Record<string, string> = {
  low: '안정',
  mid: '중립',
  high: '위험',
}

function formatPrice(value: number, priceType: 'index' | 'stock'): string {
  if (priceType === 'index') {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
  }
  return Math.round(value).toLocaleString('ko-KR')
}

const TickerChip = memo(function TickerChip({
  item,
  onSelect,
}: {
  item: TickerItem
  onSelect: (item: TickerItem) => void
}) {
  const isUp = item.change >= 0
  const priceLabel = formatPrice(item.current_price, item.price_type)
  // 지수(KOSPI/KOSDAQ 등) 는 개별 종목 페이지가 없으므로 비활성화
  const clickable = item.price_type === 'stock'

  const content = (
    <>
      <span className="text-muted-foreground text-xs font-mono">
        {item.name}
      </span>
      <span className="text-foreground text-xs font-mono font-semibold tracking-tight">
        {priceLabel}
      </span>
      <span
        className={`flex items-center gap-0.5 text-xs font-mono font-medium ${
          isUp ? 'text-bull' : 'text-bear'
        }`}
      >
        {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {isUp ? '+' : ''}
        {item.change_pct.toFixed(2)}%
      </span>
    </>
  )

  if (!clickable) {
    return (
      <div className="flex items-center gap-2 px-4 py-1 border-r border-border/40 shrink-0">
        {content}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(item)}
      className="flex items-center gap-2 px-4 py-1 border-r border-border/40 shrink-0 hover:bg-muted/40 transition-colors cursor-pointer"
      title={`${item.name} 워룸으로 이동`}
      aria-label={`${item.name} ${item.symbol}, ${priceLabel}원, ${isUp ? '상승' : '하락'} ${item.change_pct.toFixed(2)}퍼센트. 클릭하여 워룸 진입.`}
    >
      {content}
    </button>
  )
})

export function TickerBar() {
  const [time, setTime] = useState<string>('')
  const { data: tickers = [] } = useMarketTickers()
  const { data: macro } = useMacroSnapshot()
  const router = useRouter()
  const setSelected = useStockStore((s) => s.setSelected)

  // 매크로 지표 추출
  const usdkrw = macro?.indicators.find((i) => i.code === 'USD/KRW')
  const vix = macro?.indicators.find((i) => i.code === 'VIX')
  const riskLevel = macro?.risk_level ?? 'mid'

  const handleSelectTicker = useCallback(
    (item: TickerItem) => {
      setSelected({
        symbol: item.symbol,
        name: item.name,
        market: 'KOSPI',
        sector: '',
      })
      router.push(`/stock/${item.symbol}`)
    },
    [setSelected, router],
  )

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const doubled = useMemo(
    () => (tickers.length > 0 ? [...tickers, ...tickers] : []),
    [tickers],
  )

  return (
    <header className="relative z-50 flex items-center h-10 bg-surface border-b border-border shrink-0">
      <div className="flex items-center gap-2 px-4 h-full border-r border-border bg-background shrink-0">
        <span className="text-primary font-mono font-bold text-sm tracking-widest text-glow-amber">
          STAR<span className="text-secondary">NION</span>
        </span>
        <span className="flex items-center gap-1 bg-bull/10 border border-bull/30 rounded px-1.5 py-0.5">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-bull inline-block" />
          <span className="text-bull text-[10px] font-mono font-semibold">
            LIVE
          </span>
        </span>
      </div>

      <div className="flex items-center px-3 h-full border-r border-border shrink-0">
        <StockSearch />
      </div>

      <div className="flex-1 overflow-hidden flex items-center h-full">
        {doubled.length > 0 ? (
          <div className="ticker-track h-full items-center">
            {doubled.map((item, i) => (
              <TickerChip
                key={`${item.symbol}-${i}`}
                item={item}
                onSelect={handleSelectTicker}
              />
            ))}
          </div>
        ) : (
          <span className="px-4 text-[10px] font-mono text-muted-foreground">
            실시간 시세 로딩 중...
          </span>
        )}
      </div>

      {/* 매크로 기상도 — docs/09 */}
      {macro && (
        <div className="flex items-center gap-2 px-3 h-full border-l border-border shrink-0">
          <span
            className="text-sm leading-none"
            title={`시장 기상도: ${WEATHER_LABEL[riskLevel]}\n${macro.risk_summary}`}
          >
            {WEATHER_ICON[riskLevel] ?? '⛅'}
          </span>
          {usdkrw && (
            <span className="text-[10px] font-mono text-muted-foreground">
              <span className="text-foreground font-semibold tabular-nums">
                {usdkrw.value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </span>
              <span className={usdkrw.change_pct >= 0 ? 'text-bear ml-0.5' : 'text-bull ml-0.5'}>
                {usdkrw.change_pct >= 0 ? '▲' : '▼'}
              </span>
            </span>
          )}
          {vix && (
            <span className="text-[10px] font-mono text-muted-foreground">
              VIX{' '}
              <span className="text-foreground font-semibold tabular-nums">
                {vix.value.toFixed(1)}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 h-full border-l border-border bg-background shrink-0">
        <TickerModeSwitcher />
        <Activity size={13} className="text-secondary ml-1" />
        <span className="text-muted-foreground text-[10px] font-mono">KST</span>
        <span className="text-foreground text-xs font-mono font-semibold">
          {time}
        </span>
      </div>
    </header>
  )
}
