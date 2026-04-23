'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  Bot,
  Gauge,
  LineChart,
  Radar,
  Search,
  Star,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { IntelligenceSidebar } from './intelligence-sidebar'
import { ScoreboardPanel } from './scoreboard-panel'
import { TradeLog } from './trade-log'
import { ExitSimulator } from './exit-simulator'
import { WatchlistPanel } from './watchlist-panel'
import { DiscoveryPanel } from './discovery-panel'
import { PriceAlertsPanel } from './price-alerts-panel'
import dynamic from 'next/dynamic'

const AIAnalysisDialog = dynamic(
  () =>
    import('./ai-analysis-dialog').then((m) => ({
      default: m.AIAnalysisDialog,
    })),
  { ssr: false },
)
import { useStockStore } from '@/stores/stock-store'

type PanelId =
  | 'intelligence'
  | 'discovery'
  | 'watchlist'
  | 'trade-log'
  | 'exit-sim'
  | 'scoreboard'
  | 'alerts'
  | 'ai-analysis'

interface RailItem {
  id: PanelId
  label: string
  Icon: LucideIcon
  color: string
  /** AI 심층 분석은 Dialog 로 뜨기 때문에 패널이 아닌 모달 방식 */
  isModal?: boolean
}

const ITEMS: RailItem[] = [
  {
    id: 'intelligence',
    label: '인텔리전스 (AI 타점·히트맵·뉴스·공시)',
    Icon: Radar,
    color: '#06b6d4',
  },
  {
    id: 'discovery',
    label: '발견 (거래대금·상승률·하락률 랭킹)',
    Icon: Search,
    color: '#8b5cf6',
  },
  {
    id: 'watchlist',
    label: '관심종목',
    Icon: Star,
    color: '#f59e0b',
  },
  {
    id: 'trade-log',
    label: '매수 기록',
    Icon: Target,
    color: '#06b6d4',
  },
  {
    id: 'exit-sim',
    label: '매도 시뮬레이터',
    Icon: Gauge,
    color: '#ef4444',
  },
  {
    id: 'scoreboard',
    label: '종목 분석 (AI 한마디 + 거장 + 기술)',
    Icon: LineChart,
    color: '#a78bfa',
  },
  {
    id: 'alerts',
    label: '가격 알림',
    Icon: Bell,
    color: '#22c55e',
  },
  {
    id: 'ai-analysis',
    label: 'AI 심층 분석',
    Icon: Bot,
    color: '#f43f5e',
    isModal: true,
  },
]


function PanelContent({ panelId }: { panelId: PanelId }) {
  switch (panelId) {
    case 'intelligence':
      // 기존 IntelligenceSidebar 는 단독 aside 로 쓰이도록 h-full overflow
      // 를 가정하지 않으므로, 패널 wrapper 에서 세로 채움 + 스크롤을 부여
      return (
        <div className="h-full overflow-y-auto thin-scrollbar">
          <IntelligenceSidebar />
        </div>
      )
    case 'discovery':
      return <DiscoveryPanel />
    case 'watchlist':
      return <WatchlistPanel />
    case 'trade-log':
      return <TradeLog />
    case 'exit-sim':
      return <ExitSimulator />
    case 'scoreboard':
      return <ScoreboardPanel />
    case 'alerts':
      return <PriceAlertsPanel />
    default:
      return null
  }
}


/**
 * 워룸 우측 레일 + 슬라이드 패널.
 *
 * - 레일(56px): 6개 아이콘. 클릭 시 패널 토글.
 * - 패널(w-96): 활성 아이콘에 해당하는 컨텐츠.
 * - AI 심층 분석은 기존 Dialog(AIAnalysisDialog) 를 열어준다.
 * - 종목이 선택되어 있지 않으면 패널 contents 가 각자의 empty state 를 출력.
 */
export function SidebarRail() {
  const selected = useStockStore((s) => s.selected)
  // 기본값으로 인텔리전스 패널이 열린 상태로 시작
  const [activePanel, setActivePanel] = useState<PanelId | null>(
    'intelligence',
  )
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  // 종목이 사라져도 인텔리전스/발견/관심종목/알림 은 유지
  useEffect(() => {
    const globalPanels: PanelId[] = [
      'intelligence',
      'discovery',
      'watchlist',
      'alerts',
    ]
    if (
      !selected &&
      activePanel &&
      !globalPanels.includes(activePanel)
    ) {
      setActivePanel(null)
    }
  }, [selected, activePanel])

  const handleClick = (item: RailItem) => {
    if (item.isModal) {
      setAiDialogOpen(true)
      return
    }
    setActivePanel((prev) => (prev === item.id ? null : item.id))
  }

  return (
    <>
      {/*
        슬라이드 패널 (활성 시 렌더). 래퍼는 박스 스타일을 가지지 않고
        각 패널 컴포넌트(glass-card rounded-xl border ...) 가 스스로 렌더 —
        기존 TechnicalScorecard/TradeLog 등이 이미 카드 구조를 가지기 때문.
      */}
      {activePanel && (
        <aside
          className="w-96 shrink-0 min-h-0"
          aria-label={
            ITEMS.find((i) => i.id === activePanel)?.label ?? '패널'
          }
        >
          <PanelContent panelId={activePanel} />
        </aside>
      )}

      {/* 레일 */}
      <nav
        className="w-12 shrink-0 min-h-0 glass-card rounded-xl border border-border flex flex-col items-center py-2 gap-1"
        aria-label="사이드바 네비게이션"
      >
        {ITEMS.map((item) => {
          const Icon = item.Icon
          const active = activePanel === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all group ${
                active
                  ? 'bg-primary/15 border border-primary/40'
                  : 'hover:bg-muted/40 border border-transparent'
              }`}
              title={item.label}
              aria-label={item.label}
              aria-pressed={active}
            >
              <Icon
                size={16}
                style={{
                  color: active ? item.color : '#94a3b8',
                }}
                className="transition-colors"
              />
              {/* 활성 표시 막대 */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{ background: item.color }}
                />
              )}
              {/* 호버 툴팁 */}
              <span className="absolute right-full mr-2 px-2 py-1 rounded bg-surface-raised border border-border text-[10px] font-mono text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      <AIAnalysisDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </>
  )
}
