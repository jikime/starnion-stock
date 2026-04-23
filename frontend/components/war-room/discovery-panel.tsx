'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import {
  Loader2,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react'
import {
  useHotStocks,
  type HotMetric,
  type HotStockRow,
} from '@/hooks/use-hot-stocks'
import { useSectors, type SectorRank } from '@/hooks/use-sectors'
import { useStockStore } from '@/stores/stock-store'
import { apiGet } from '@/lib/api-client'
import type { MasterScores } from '@/hooks/use-master-scores'
import { MarketBriefingCard } from './market-briefing-card'

const OVERLAY_TOP_N = 5  // 상위 N개만 거장 스코어 조회

type TabId = HotMetric | 'sectors'

const TABS: { id: TabId; label: string; color: string }[] = [
  { id: 'value', label: '거래대금', color: 'text-primary' },
  { id: 'volume', label: '거래량', color: 'text-secondary' },
  { id: 'change', label: '상승률', color: 'text-bull' },
  { id: 'fall', label: '하락률', color: 'text-bear' },
  { id: 'sectors', label: '섹터', color: 'text-[#a78bfa]' },
]

function formatTradeValue(won: number): string {
  // 네이버 trade_value 는 천원 단위. 단위 변환.
  const billion = (won * 1000) / 100_000_000
  if (billion >= 1000) return `${(billion / 10000).toFixed(1)}조`
  if (billion >= 1) return `${billion.toFixed(0)}억`
  return `${(won / 1000).toFixed(0)}천`
}

function formatVolume(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`
  return v.toLocaleString('ko-KR')
}

/**
 * 발견 패널 — 네이버 금융 랭킹 래핑.
 * 4개 탭: 거래대금 / 거래량 / 상승률 / 하락률 (각 상위 20개)
 */
export function DiscoveryPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('value')
  const [market, setMarket] = useState<'KOSPI' | 'KOSDAQ'>('KOSPI')
  const [overlayOn, setOverlayOn] = useState(false)
  const hotMetric: HotMetric =
    activeTab === 'sectors' ? 'value' : activeTab
  const { data: rows = [], isLoading } = useHotStocks(hotMetric, market, 20)
  const { data: sectors = [], isLoading: sectorsLoading } = useSectors()

  // 거장 스코어 오버레이 — 상위 N개만 병렬 조회 (활성 시)
  const topSymbols = useMemo(
    () => rows.slice(0, OVERLAY_TOP_N).map((r) => r.symbol),
    [rows],
  )
  const masterQueries = useQueries({
    queries: topSymbols.map((sym) => ({
      queryKey: ['master-scores', sym],
      queryFn: () => apiGet<MasterScores>(`/stocks/${sym}/master-scores`),
      enabled: overlayOn && activeTab !== 'sectors' && !!sym,
      staleTime: 5 * 60_000,
    })),
  })
  const scoreMap = useMemo(() => {
    const m = new Map<string, number>()
    topSymbols.forEach((sym, i) => {
      const d = masterQueries[i]?.data
      if (d) m.set(sym, d.star_score)
    })
    return m
  }, [topSymbols, masterQueries])

  const router = useRouter()
  const setSelected = useStockStore((s) => s.setSelected)

  const handleClick = useCallback(
    (row: HotStockRow) => {
      setSelected({
        symbol: row.symbol,
        name: row.name,
        market,
        sector: '',
      })
      router.push(`/stock/${row.symbol}`)
    },
    [setSelected, market, router],
  )

  const isSectorTab = activeTab === 'sectors'

  return (
    <div className="glass-card rounded-xl border border-border h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Search size={12} className="text-primary" />
          발견
        </h3>
        {!isSectorTab && (
          <div className="flex rounded border border-border/40 overflow-hidden">
            <button
              onClick={() => setMarket('KOSPI')}
              className={`text-[10px] font-mono px-2 py-0.5 ${
                market === 'KOSPI'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              KOSPI
            </button>
            <button
              onClick={() => setMarket('KOSDAQ')}
              className={`text-[10px] font-mono px-2 py-0.5 border-l border-border/40 ${
                market === 'KOSDAQ'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              KOSDAQ
            </button>
          </div>
        )}
      </div>

      {/* AI 시장 브리핑 카드 — 확장 가능 */}
      <MarketBriefingCard />

      {/* 탭 */}
      <div className="flex gap-1 px-3 py-2 border-b border-border/30 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-[11px] font-mono py-1 rounded transition-colors ${
              activeTab === tab.id
                ? `bg-muted/40 ${tab.color} border border-border/40`
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 거장 스코어 오버레이 토글 — 종목 탭에서만 */}
      {!isSectorTab && (
        <div className="px-3 py-1.5 border-b border-border/30 shrink-0 flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground">
            상위 {OVERLAY_TOP_N}개 거장 점수
          </span>
          <button
            onClick={() => setOverlayOn(!overlayOn)}
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              overlayOn
                ? 'bg-primary/15 text-primary border-primary/40'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star size={10} fill={overlayOn ? '#f59e0b' : 'none'} />
            {overlayOn ? 'ON' : 'OFF'}
          </button>
        </div>
      )}

      {/* 리스트 / 히트맵 */}
      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        {isSectorTab ? (
          <SectorHeatmap sectors={sectors} isLoading={sectorsLoading} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
            <span className="text-[11px] font-mono text-muted-foreground">
              랭킹 로딩 중...
            </span>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono text-muted-foreground">
            데이터가 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {rows.map((row) => {
              const isUp = row.change >= 0
              const starScore = overlayOn ? scoreMap.get(row.symbol) : null
              return (
                <li key={row.symbol}>
                  <button
                    onClick={() => handleClick(row)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors text-left"
                  >
                    {/* 순위 */}
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-5 shrink-0 text-right">
                      {row.rank}
                    </span>

                    {/* 종목명 + 코드 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-display font-bold text-foreground truncate">
                          {row.name}
                        </span>
                        {starScore != null && (
                          <span
                            className={`flex items-center gap-0.5 text-[9px] font-mono font-bold rounded px-1 py-0 tabular-nums ${
                              starScore >= 70
                                ? 'bg-bull/15 text-bull border border-bull/40'
                                : starScore >= 40
                                  ? 'bg-secondary/15 text-secondary border border-secondary/40'
                                  : 'bg-bear/15 text-bear border border-bear/40'
                            }`}
                          >
                            <Star size={8} fill="currentColor" />
                            {starScore}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground tabular-nums">
                        {row.symbol}
                        {activeTab === 'value' && (
                          <span className="ml-1.5">
                            · {formatTradeValue(row.trade_value)}
                          </span>
                        )}
                        {activeTab === 'volume' && (
                          <span className="ml-1.5">
                            · {formatVolume(row.volume)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 현재가 + 등락 */}
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-mono font-bold tabular-nums ${
                          isUp ? 'text-bull' : 'text-bear'
                        }`}
                      >
                        {Math.round(row.price).toLocaleString('ko-KR')}
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
                        {row.change_pct.toFixed(2)}%
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border/30 shrink-0 text-[8px] font-mono text-muted-foreground/60 text-center">
        Source: Naver Finance · {isSectorTab ? '5분' : '2분'}마다 갱신
      </div>
    </div>
  )
}


// ──────────────────────────────────────────────────────────────────────
// 섹터 히트맵
// ──────────────────────────────────────────────────────────────────────

function sectorColor(pct: number): string {
  // 등락률에 따른 배경 색상 (bull=red/빨강, bear=blue/파랑 한국식)
  if (pct >= 3) return 'bg-bull/40'
  if (pct >= 1) return 'bg-bull/25'
  if (pct > 0) return 'bg-bull/10'
  if (pct === 0) return 'bg-muted/30'
  if (pct > -1) return 'bg-bear/10'
  if (pct > -3) return 'bg-bear/25'
  return 'bg-bear/40'
}

function SectorHeatmap({
  sectors,
  isLoading,
}: {
  sectors: SectorRank[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 gap-2">
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
        <span className="text-[11px] font-mono text-muted-foreground">
          섹터 로딩 중...
        </span>
      </div>
    )
  }

  if (sectors.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[11px] font-mono text-muted-foreground">
        섹터 데이터가 없습니다.
      </div>
    )
  }

  // 요약 통계
  const avgChange =
    sectors.reduce((s, x) => s + x.change_pct, 0) / sectors.length
  const upSectors = sectors.filter((s) => s.change_pct > 0).length
  const downSectors = sectors.filter((s) => s.change_pct < 0).length

  return (
    <div className="p-3 space-y-3">
      {/* 요약 */}
      <div className="flex items-center justify-between rounded border border-border/40 bg-muted/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <LayoutGrid size={12} className="text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground">
            총 {sectors.length} 업종
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-bull">▲{upSectors}</span>
          <span className="text-bear">▼{downSectors}</span>
          <span
            className={`font-bold tabular-nums ${
              avgChange >= 0 ? 'text-bull' : 'text-bear'
            }`}
          >
            {avgChange >= 0 ? '+' : ''}
            {avgChange.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 타일 그리드 */}
      <div className="grid grid-cols-2 gap-1.5">
        {sectors.map((sector) => {
          const bg = sectorColor(sector.change_pct)
          const isUp = sector.change_pct >= 0
          return (
            <div
              key={sector.name}
              className={`${bg} rounded border border-border/30 px-2 py-1.5 min-w-0`}
              title={`${sector.name}: ${sector.up_count}↑/${sector.down_count}↓/${sector.flat_count}-`}
            >
              <div className="text-[10px] font-mono font-bold text-foreground truncate">
                {sector.name}
              </div>
              <div
                className={`text-[11px] font-mono tabular-nums font-bold ${
                  isUp ? 'text-bull' : 'text-bear'
                }`}
              >
                {isUp ? '+' : ''}
                {sector.change_pct.toFixed(2)}%
              </div>
              <div className="text-[8px] font-mono text-muted-foreground">
                {sector.total_count}종목 · {sector.up_count}↑/
                {sector.down_count}↓
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
