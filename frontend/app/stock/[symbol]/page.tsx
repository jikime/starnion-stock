'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TickerBar } from '@/components/war-room/ticker-bar'
import { AIChart } from '@/components/war-room/ai-chart'
import { AIBriefingToast } from '@/components/war-room/ai-briefing-toast'
import { AlertMonitor } from '@/components/war-room/alert-monitor'
import dynamic from 'next/dynamic'

const ShortcutsDialog = dynamic(
  () =>
    import('@/components/war-room/shortcuts-dialog').then((m) => ({
      default: m.ShortcutsDialog,
    })),
  { ssr: false },
)
import { SidebarRail } from '@/components/war-room/sidebar-rail'
import { useAllStocks } from '@/hooks/use-stock-list'
import { useStockStore } from '@/stores/stock-store'

/**
 * 종목 워룸 페이지.
 *
 * 레이아웃:
 *   TickerBar (상단)
 *   │
 *   ├─ AIChart (차트/RSI/뉴스 타임라인 — flex-1, 가장 큰 영역)
 *   ├─ IntelligenceSidebar (뉴스·감성·공시 — 차트와 항상 함께)
 *   ├─ [활성 패널] (관심종목/매수기록/매도시뮬/거장/기술)
 *   └─ Rail (6 icons)
 *
 * 기술지표·거장스코어·매수기록·매도시뮬·관심종목·AI심층분석은 모두 Rail 로
 * 이동. 기본 화면은 차트 + 인텔리전스만 노출하여 시선을 집중시킨다.
 */
export default function WarRoomPage() {
  const params = useParams<{ symbol: string }>()
  const urlSymbol = params?.symbol
  const { data: allStocks = [] } = useAllStocks()
  const selected = useStockStore((s) => s.selected)
  const setSelected = useStockStore((s) => s.setSelected)

  useEffect(() => {
    if (!urlSymbol) return
    const match = allStocks.find((s) => s.symbol === urlSymbol)
    if (match) {
      // allStocks 로드 완료 시:
      //   - 다른 종목이거나
      //   - 같은 심볼이지만 name 이 아직 fallback(= symbol) 이면
      // 정식 Stock 으로 덮어쓴다.
      if (
        !selected ||
        selected.symbol !== urlSymbol ||
        selected.name !== match.name
      ) {
        setSelected(match)
      }
    } else if (!selected || selected.symbol !== urlSymbol) {
      // allStocks 로드 전 임시 fallback (name=symbol) — 차후 effect 에서 갱신됨
      setSelected({
        symbol: urlSymbol,
        name: urlSymbol,
        market: 'KOSPI',
        sector: '',
      })
    }
  }, [urlSymbol, allStocks, selected, setSelected])

  return (
    <main className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <TickerBar />

      <div className="flex flex-1 min-h-0 gap-3 p-3">
        {/* 메인 차트 영역 */}
        <section className="flex-1 min-w-0 min-h-0" aria-label="AI 타점 차트">
          <AIChart />
        </section>

        {/* 우측 레일 + 슬라이드 패널 (인텔리전스가 기본 활성) */}
        <SidebarRail />
      </div>

      <AIBriefingToast />
      <AlertMonitor />
      <ShortcutsDialog />

      <footer className="shrink-0 border-t border-border bg-surface/60 px-4 py-1.5 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground font-mono text-center">
          본 서비스의 분석은 투자 참고용이며 결과에 대한 책임은 사용자에게 있습니다.
        </p>
      </footer>
    </main>
  )
}
