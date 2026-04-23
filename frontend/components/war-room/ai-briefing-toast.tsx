'use client'

import { useEffect, useRef, useState } from 'react'
import { Target, TrendingUp, X, Zap } from 'lucide-react'
import { useStockStore } from '@/stores/stock-store'
import { useStockBriefing, type Briefing } from '@/hooks/use-stock-briefing'

type BriefingType = 'buy' | 'alert' | 'info'

interface BriefingMessage {
  id: string
  stock: string
  message: string
  type: BriefingType
}

const TYPE_CONFIG = {
  buy: {
    border: 'border-primary/50',
    glow: 'glow-amber',
    icon: Target,
    iconColor: 'text-primary',
    badge: 'BUY ZONE',
    badgeCls: 'bg-primary/20 text-primary border-primary/40 text-glow-amber',
  },
  alert: {
    border: 'border-bear/50',
    glow: 'glow-bear',
    icon: TrendingUp,
    iconColor: 'text-bear',
    badge: '주의',
    badgeCls: 'bg-bear/20 text-bear border-bear/40',
  },
  info: {
    border: 'border-secondary/50',
    glow: 'glow-cyan',
    icon: Zap,
    iconColor: 'text-secondary',
    badge: 'INFO',
    badgeCls: 'bg-secondary/20 text-secondary border-secondary/40',
  },
}

function mapBriefingType(briefing: Briefing): BriefingType {
  if (briefing.signal_type === 'BUY') return 'buy'
  if (briefing.signal_type === 'SELL') return 'alert'
  return 'info'
}

interface ToastProps {
  briefing: BriefingMessage
  onClose: (id: string) => void
}

function BriefingToast({ briefing, onClose }: ToastProps) {
  const cfg = TYPE_CONFIG[briefing.type]
  const Icon = cfg.icon

  useEffect(() => {
    const timer = setTimeout(() => onClose(briefing.id), 9_000)
    return () => clearTimeout(timer)
  }, [briefing.id, onClose])

  return (
    <div
      className={`toast-slide-in rounded-xl border ${cfg.border} ${cfg.glow} p-4 max-w-xs w-full`}
      style={{ background: 'rgb(20, 25, 45)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon size={16} className={cfg.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-display font-bold text-foreground">
              {briefing.stock}
            </span>
            <span
              className={`text-[9px] font-mono font-bold rounded border px-1.5 py-0.5 ${cfg.badgeCls}`}
            >
              {cfg.badge}
            </span>
          </div>
          <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
            {briefing.message}
          </p>
          <div className="flex items-center gap-1 mt-2">
            <Zap size={9} className="text-primary" />
            <span className="text-[9px] text-primary font-mono">
              Nion AI Briefing
            </span>
          </div>
        </div>
        <button
          onClick={() => onClose(briefing.id)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 bg-muted rounded-full h-0.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            animation: 'progress-drain 9s linear forwards',
            width: '100%',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes progress-drain {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}

export function AIBriefingToast() {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null
  const { data: briefing } = useStockBriefing(symbol)

  const [visible, setVisible] = useState<BriefingMessage[]>([])
  // shownIds 는 effect 재실행을 트리거하지 않도록 ref 로 관리.
  // (deps 에 Set 을 넣으면 setShownIds 호출마다 레퍼런스가 바뀌어 effect 가
  //  재실행되고 stale closure 로 같은 id 가 중복 push 되던 버그를 방지)
  const shownIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!briefing || !symbol) return
    // 이전 종목 브리핑이 캐시에서 남아있을 수 있으므로 현재 심볼과 비교
    if (briefing.symbol !== symbol) return

    const id = `${briefing.symbol}-${briefing.signal_type}`
    if (shownIdsRef.current.has(id)) return
    shownIdsRef.current.add(id)

    const message: BriefingMessage = {
      id,
      stock: briefing.stock_name,
      message: briefing.message,
      type: mapBriefingType(briefing),
    }
    setVisible((prev) => {
      if (prev.some((m) => m.id === id)) return prev
      return [...prev, message]
    })
  }, [briefing, symbol])

  // 종목이 바뀌면 기존 토스트 제거 + shownIds 초기화
  useEffect(() => {
    setVisible([])
    shownIdsRef.current = new Set()
  }, [symbol])

  const handleClose = (id: string) => {
    setVisible((prev) => prev.filter((b) => b.id !== id))
  }

  if (visible.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
      role="region"
      aria-label="AI 브리핑 알림"
    >
      {visible.map((b) => (
        <BriefingToast key={b.id} briefing={b} onClose={handleClose} />
      ))}
    </div>
  )
}
