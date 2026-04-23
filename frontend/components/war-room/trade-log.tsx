'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  useDeleteTrade,
  useTradeLog,
  type TradeEntry,
} from '@/hooks/use-trade-log'
import { useAllStocks } from '@/hooks/use-stock-list'
import { useStockStore, type Stock } from '@/stores/stock-store'
import { apiGet } from '@/lib/api-client'
import type { TickerItem } from '@/hooks/use-market-tickers'
import dynamic from 'next/dynamic'

const TradeEntryDialog = dynamic(
  () =>
    import('./trade-entry-dialog').then((m) => ({
      default: m.TradeEntryDialog,
    })),
  { ssr: false },
)
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const EMOTION_COLOR: Record<TradeEntry['emotion'], string> = {
  확신: 'text-bull bg-bull/10 border-bull/30',
  흥분: 'text-primary bg-primary/10 border-primary/30',
  중립: 'text-secondary bg-secondary/10 border-secondary/30',
  불안: 'text-bear bg-bear/10 border-bear/30',
}

const STATUS_CONFIG = {
  open: {
    label: '보유중',
    icon: Clock,
    cls: 'text-secondary bg-secondary/10 border-secondary/30',
  },
  closed: {
    label: '종료',
    icon: TrendingDown,
    cls: 'text-bear bg-bear/10 border-bear/30',
  },
  target: {
    label: '목표달성',
    icon: CheckCircle,
    cls: 'text-bull bg-bull/10 border-bull/30',
  },
} as const

function PnLBadge({
  entry,
  current,
}: {
  entry: number
  current: number | null
}) {
  if (current == null) {
    return (
      <span className="text-xs font-mono font-bold text-muted-foreground">
        —
      </span>
    )
  }
  const pnl = current - entry
  const pnlPct = entry ? (pnl / entry) * 100 : 0
  const isUp = pnl >= 0
  return (
    <span
      className={`flex items-center gap-1 text-xs font-mono font-bold ${
        isUp ? 'text-bull' : 'text-bear'
      }`}
    >
      {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {isUp ? '+' : ''}
      {pnlPct.toFixed(2)}%
    </span>
  )
}

function TargetProgress({
  entry,
  current,
  target,
}: {
  entry: number
  current: number | null
  target: number
}) {
  const cur = current ?? entry
  const progress = Math.min(
    Math.max(((cur - entry) / (target - entry)) * 100, 0),
    100,
  )
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1 overflow-hidden">
        <div
          className="h-full rounded-full bg-bull transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">
        {Math.round(progress)}%
      </span>
    </div>
  )
}

// ── 매매 일지 통계 ──────────────────────────────────────────────────────

function TradeStats({
  trades,
  getLivePrice,
}: {
  trades: TradeEntry[]
  getLivePrice: (t: TradeEntry) => number | null
}) {
  if (trades.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[11px] font-mono text-muted-foreground">
        매매 기록이 없습니다. 통계를 확인하려면 매수 기록을 추가하세요.
      </div>
    )
  }

  // 각 거래의 수익률 계산 (open=live price, closed/target=current_price 최종값)
  const computed = trades.map((t) => {
    const cur = getLivePrice(t) ?? t.entry_price
    const pnlPct = t.entry_price
      ? ((cur - t.entry_price) / t.entry_price) * 100
      : 0
    const pnl = (cur - t.entry_price) * t.qty
    return { ...t, cur, pnlPct, pnl }
  })

  const totalCount = computed.length
  const winCount = computed.filter((t) => t.pnlPct > 0).length
  const loseCount = computed.filter((t) => t.pnlPct < 0).length
  const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : 0
  const avgReturn =
    totalCount > 0
      ? computed.reduce((s, t) => s + t.pnlPct, 0) / totalCount
      : 0
  const totalPnL = computed.reduce((s, t) => s + t.pnl, 0)

  // 평균 보유 기간
  const now = new Date()
  const avgDays =
    totalCount > 0
      ? computed.reduce((s, t) => {
          const entry = new Date(`${t.date}T${t.time || '00:00:00'}`)
          return s + (now.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)
        }, 0) / totalCount
      : 0

  // 감정별 집계
  const emotions: TradeEntry['emotion'][] = ['확신', '불안', '중립', '흥분']
  const emotionStats = emotions.map((em) => {
    const group = computed.filter((t) => t.emotion === em)
    if (group.length === 0) return { emotion: em, count: 0, avg: 0 }
    const avg = group.reduce((s, t) => s + t.pnlPct, 0) / group.length
    return { emotion: em, count: group.length, avg }
  })

  const maxEmotionCount = Math.max(...emotionStats.map((e) => e.count), 1)

  return (
    <div className="p-3 space-y-3">
      {/* 요약 카드 2x2 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">
            총 거래
          </div>
          <div className="text-base font-mono font-bold tabular-nums">
            {totalCount}건
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
            ✓{winCount} · ✕{loseCount}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">
            승률
          </div>
          <div
            className={`text-base font-mono font-bold tabular-nums ${
              winRate >= 50 ? 'text-bull' : 'text-bear'
            }`}
          >
            {winRate.toFixed(1)}%
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
            {winCount}/{totalCount}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">
            평균 수익률
          </div>
          <div
            className={`text-base font-mono font-bold tabular-nums ${
              avgReturn >= 0 ? 'text-bull' : 'text-bear'
            }`}
          >
            {avgReturn >= 0 ? '+' : ''}
            {avgReturn.toFixed(2)}%
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
            보유 {avgDays.toFixed(0)}일 평균
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">
            총 평가손익
          </div>
          <div
            className={`text-base font-mono font-bold tabular-nums ${
              totalPnL >= 0 ? 'text-bull' : 'text-bear'
            }`}
          >
            {totalPnL >= 0 ? '+' : ''}
            {Math.round(totalPnL).toLocaleString('ko-KR')}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">원</div>
        </div>
      </div>

      {/* 감정별 수익률 */}
      <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
        <div className="text-[9px] font-mono text-muted-foreground uppercase mb-2">
          감정별 결과
        </div>
        <div className="space-y-1.5">
          {emotionStats.map((es) => {
            const barWidth = (es.count / maxEmotionCount) * 100
            const barColor =
              es.avg >= 0 ? 'bg-bull/40' : 'bg-bear/40'
            return (
              <div key={es.emotion} className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground w-8 shrink-0">
                  {es.emotion}
                </span>
                <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden relative">
                  <div
                    className={`h-full ${barColor} transition-all`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[9px] font-mono tabular-nums text-foreground">
                    {es.count}건
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono tabular-nums w-14 text-right shrink-0 ${
                    es.count === 0
                      ? 'text-muted-foreground'
                      : es.avg >= 0
                        ? 'text-bull'
                        : 'text-bear'
                  }`}
                >
                  {es.count === 0
                    ? '—'
                    : `${es.avg >= 0 ? '+' : ''}${es.avg.toFixed(1)}%`}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 pt-2 border-t border-border/30 text-[9px] font-mono text-muted-foreground leading-relaxed">
          💡 확신·중립 수익률이 불안·흥분보다 높으면 감정이 안정된 거래가 유리함을 의미합니다.
        </p>
      </div>
    </div>
  )
}


export function TradeLog() {
  const [activeTab, setActiveTab] = useState<'log' | 'strategy' | 'stats'>('log')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TradeEntry | null>(null)
  const { data: trades = [], isLoading } = useTradeLog()
  const deleteMutation = useDeleteTrade()

  // 종목 전환을 위한 전체 종목 목록 (market/sector 까지 포함한 Stock 객체 lookup)
  const { data: allStocks = [] } = useAllStocks()
  const setSelected = useStockStore((s) => s.setSelected)

  // 보유 종목 심볼 추출 → 전용 실시간 가격 조회
  const tradeSymbols = Array.from(
    new Set(trades.filter((t) => t.status === 'open').map((t) => t.symbol)),
  ).join(',')

  const { data: tradeTickers = [] } = useQuery({
    queryKey: ['trade-tickers', tradeSymbols],
    queryFn: () =>
      apiGet<TickerItem[]>(`/market/tickers?symbols=${tradeSymbols}`),
    enabled: tradeSymbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const liveTickerMap = useMemo(
    () =>
      new Map(
        tradeTickers
          .filter((t) => t.price_type === 'stock')
          .map((t) => [t.symbol, t]),
      ),
    [tradeTickers],
  )

  const router = useRouter()

  const handleSelectSymbol = (trade: TradeEntry) => {
    const match = allStocks.find((s) => s.symbol === trade.symbol)
    const stock: Stock = match ?? {
      symbol: trade.symbol,
      name: trade.name,
      market: 'KOSPI',
      sector: '',
    }
    setSelected(stock)
    router.push(`/stock/${stock.symbol}`)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
    } finally {
      setDeleteTarget(null)
    }
  }

  // live ticker 우선, 없으면 trade.current_price 폴백
  const getLivePrice = useCallback(
    (trade: TradeEntry): number | null =>
      liveTickerMap.get(trade.symbol)?.current_price ?? trade.current_price,
    [liveTickerMap],
  )

  const getLiveTicker = useCallback(
    (trade: TradeEntry) => liveTickerMap.get(trade.symbol) ?? null,
    [liveTickerMap],
  )

  const openTrades = trades.filter((t) => t.status === 'open')
  const totalPnL = openTrades.reduce(
    (acc, t) => acc + ((getLivePrice(t) ?? t.entry_price) - t.entry_price) * t.qty,
    0,
  )
  const isUp = totalPnL >= 0

  return (
    <div className="glass-card rounded-xl border border-border flex flex-col h-full overflow-hidden">
      {/* 헤더 — w-96 에 맞게 세로 2줄 */}
      <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('log')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                activeTab === 'log'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target size={11} />
              Log
            </button>
            <button
              onClick={() => setActiveTab('strategy')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                activeTab === 'strategy'
                  ? 'bg-secondary/20 text-secondary border border-secondary/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen size={11} />
              전략
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                activeTab === 'stats'
                  ? 'bg-bull/20 text-bull border border-bull/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 size={11} />
              통계
            </button>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1 bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-primary text-[11px] font-mono rounded-lg px-2 py-1"
          >
            <Plus size={11} />
            매수 기록
          </button>
          <TradeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>

        {/* 평가손익 — 헤더 아래 작은 요약 바 */}
        <div className="flex items-center justify-between rounded bg-muted/20 border border-border/40 px-2 py-1">
          <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">
            평가손익
          </span>
          <span
            className={`text-xs font-mono font-bold tabular-nums ${
              isUp ? 'text-bull' : 'text-bear'
            }`}
          >
            {isUp ? '+' : ''}
            {totalPnL.toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono text-muted-foreground">
            로딩 중...
          </div>
        ) : trades.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono text-muted-foreground">
            매매 기록이 없습니다. 종목 선택 후 "매수 기록" 버튼을 눌러
            시작하세요.
          </div>
        ) : activeTab === 'log' ? (
          <div className="p-2 space-y-2">
            {trades.map((trade) => {
              const cfg = STATUS_CONFIG[trade.status] ?? STATUS_CONFIG.open
              const StatusIcon = cfg.icon
              const isExpanded = expandedId === trade.id
              return (
                <div
                  key={trade.id}
                  className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden transition-colors hover:border-primary/30"
                >
                  {/* 카드 헤더 — 종목명 + 상태 + 감정 */}
                  <div
                    className="flex items-start justify-between gap-2 px-3 py-2 cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : trade.id)
                    }
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectSymbol(trade)
                      }}
                      className="text-left min-w-0 group"
                      title="차트를 이 종목으로 전환"
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-display font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {trade.name}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                          {trade.symbol}
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                        {trade.date} {trade.time} · {trade.qty}주
                      </div>
                    </button>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <PnLBadge
                        entry={trade.entry_price}
                        current={getLivePrice(trade)}
                      />
                      <div className="flex items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[9px] rounded border px-1.5 py-0 ${cfg.cls}`}
                        >
                          <StatusIcon size={8} />
                          {cfg.label}
                        </span>
                        <span
                          className={`text-[9px] rounded border px-1.5 py-0 ${
                            EMOTION_COLOR[trade.emotion] ?? ''
                          }`}
                        >
                          {trade.emotion}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 가격 3칸 그리드 */}
                  <div
                    className="grid grid-cols-3 gap-0 text-[10px] font-mono border-t border-border/30 cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : trade.id)
                    }
                  >
                    <div className="px-2 py-1.5 text-center border-r border-border/30">
                      <div className="text-[9px] text-muted-foreground uppercase">
                        진입
                      </div>
                      <div className="text-foreground tabular-nums">
                        {trade.entry_price.toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <div className="px-2 py-1.5 text-center border-r border-border/30">
                      <div className="text-[9px] text-muted-foreground uppercase">
                        현재
                      </div>
                      <div
                        className={`tabular-nums ${
                          (getLivePrice(trade) ?? trade.entry_price) >=
                          trade.entry_price
                            ? 'text-bull'
                            : 'text-bear'
                        }`}
                      >
                        {(
                          getLivePrice(trade) ?? trade.entry_price
                        ).toLocaleString('ko-KR')}
                      </div>
                      {(() => {
                        const tk = getLiveTicker(trade)
                        if (!tk) return null
                        const up = tk.change >= 0
                        return (
                          <div
                            className={`flex items-center justify-center gap-0.5 text-[9px] tabular-nums mt-0.5 ${
                              up ? 'text-bull' : 'text-bear'
                            }`}
                          >
                            {up ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                            {up ? '+' : ''}{tk.change_pct.toFixed(2)}%
                          </div>
                        )
                      })()}
                    </div>
                    <div className="px-2 py-1.5 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase">
                        목표
                      </div>
                      <div className="text-primary tabular-nums">
                        {trade.target_price.toLocaleString('ko-KR')}
                      </div>
                    </div>
                  </div>

                  {/* 목표 진행 바 (보유중 상태만) */}
                  {trade.status === 'open' && (
                    <div className="px-3 py-1.5 border-t border-border/30">
                      <TargetProgress
                        entry={trade.entry_price}
                        current={getLivePrice(trade)}
                        target={trade.target_price}
                      />
                    </div>
                  )}

                  {/* 확장: 뉴스 스냅샷 + 전략 노트 + 삭제 */}
                  {isExpanded && (
                    <div className="px-3 py-2 bg-muted/20 border-t border-border/30 space-y-2">
                      <div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
                          진입 당시 뉴스
                        </div>
                        <p className="text-[11px] font-sans text-foreground leading-relaxed">
                          {trade.news_snapshot || '—'}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-[9px] font-mono text-primary uppercase tracking-wider mb-0.5">
                          <BookOpen size={9} />
                          전략 노트
                        </div>
                        <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
                          {trade.strategy_note || '—'}
                        </p>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(trade)
                          }}
                          className="text-[10px] font-mono text-bear hover:text-bear/80"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : activeTab === 'strategy' ? (
          <div className="p-4 space-y-3">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="bg-muted/20 border border-border/50 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {trade.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {trade.date}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {trade.strategy_note || '전략 메모 없음'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <TradeStats trades={trades} getLivePrice={getLivePrice} />
        )}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="border-border" style={{ background: 'rgb(20, 25, 45)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono flex items-center gap-2">
              <span className="text-bear">매매 기록 삭제</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-[11px] leading-relaxed">
              {deleteTarget && (
                <>
                  <span className="text-foreground font-semibold">
                    {deleteTarget.name}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    ({deleteTarget.symbol})
                  </span>{' '}
                  <span className="text-muted-foreground">
                    · {deleteTarget.date} {deleteTarget.time}
                  </span>
                  <br />
                  진입가{' '}
                  <span className="text-foreground">
                    {deleteTarget.entry_price.toLocaleString('ko-KR')}원
                  </span>{' '}
                  · 수량{' '}
                  <span className="text-foreground">{deleteTarget.qty}주</span>
                  <br />
                  <span className="text-bear/80">
                    이 기록을 삭제하면 복구할 수 없습니다.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="font-mono"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="font-mono bg-bear text-white hover:bg-bear/90"
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
