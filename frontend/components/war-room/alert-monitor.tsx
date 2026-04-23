'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRing, X, ArrowUp, ArrowDown } from 'lucide-react'
import { useAlertStore, type PriceAlert } from '@/stores/alert-store'
import { apiGet } from '@/lib/api-client'
import type { TickerItem } from '@/hooks/use-market-tickers'

/**
 * 가격 알림 모니터 — 백그라운드 폴링 + 트리거 토스트.
 *
 * - 활성(triggered=false) 알림의 고유 심볼을 수집
 * - /market/tickers 로 30초마다 가격 폴링
 * - 조건 매칭 시 markTriggered + 토스트 + 브라우저 알림
 */
export function AlertMonitor() {
  const alerts = useAlertStore((s) => s.alerts)
  const markTriggered = useAlertStore((s) => s.markTriggered)

  const [firedToasts, setFiredToasts] = useState<PriceAlert[]>([])
  // 중복 트리거 방지용 — 이미 처리한 id
  const processedRef = useRef<Set<string>>(new Set())

  // 활성 알림 심볼만 추출
  const symbols = useMemo(() => {
    const set = new Set<string>()
    alerts.forEach((a) => {
      if (!a.triggered) set.add(a.symbol)
    })
    return Array.from(set).sort().join(',')
  }, [alerts])

  // F5: select 로 price Map 만 추출 — 불필요한 재렌더 방지
  const { data: priceMap } = useQuery({
    queryKey: ['alert-monitor-tickers', symbols],
    queryFn: () => apiGet<TickerItem[]>(`/market/tickers?symbols=${symbols}`),
    enabled: symbols.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
    select: (tickers): Map<string, number> =>
      new Map(tickers.map((t) => [t.symbol, t.current_price])),
  })

  // 가격과 알림 비교
  useEffect(() => {
    if (!priceMap || priceMap.size === 0) return

    alerts.forEach((alert) => {
      if (alert.triggered) return
      if (processedRef.current.has(alert.id)) return
      const price = priceMap.get(alert.symbol)
      if (price == null) return

      const hit =
        alert.direction === 'above'
          ? price >= alert.targetPrice
          : price <= alert.targetPrice

      if (hit) {
        processedRef.current.add(alert.id)
        markTriggered(alert.id)
        setFiredToasts((prev) => [...prev, alert])

        // 브라우저 알림 (권한 있을 때)
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('StarNion 가격 알림', {
            body: `${alert.stockName} ${Math.round(alert.targetPrice).toLocaleString('ko-KR')}원 ${
              alert.direction === 'above' ? '상회' : '하회'
            }`,
            icon: '/favicon.ico',
          })
        }
      }
    })
  }, [priceMap, alerts, markTriggered])

  // 초기 진입 시 브라우저 알림 권한 요청 (한 번만)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {
        /* ignore */
      })
    }
  }, [])

  const handleClose = (id: string) => {
    setFiredToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (firedToasts.length === 0) return null

  return (
    <div
      className="fixed bottom-20 right-6 z-[100] flex flex-col gap-2"
      role="region"
      aria-label="가격 알림"
    >
      {firedToasts.map((alert) => (
        <AlertToast key={alert.id} alert={alert} onClose={handleClose} />
      ))}
    </div>
  )
}


function AlertToast({
  alert,
  onClose,
}: {
  alert: PriceAlert
  onClose: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(alert.id), 15_000)
    return () => clearTimeout(timer)
  }, [alert.id, onClose])

  const isAbove = alert.direction === 'above'
  const color = isAbove ? 'bull' : 'bear'

  return (
    <div
      className={`toast-slide-in rounded-xl border border-${color}/50 glow-${color === 'bull' ? 'amber' : 'bear'} p-4 max-w-xs w-full`}
      style={{ background: 'rgb(20, 25, 45)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-lg bg-${color}/10 flex items-center justify-center shrink-0`}
        >
          <BellRing size={16} className={`text-${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-display font-bold text-foreground">
              {alert.stockName}
            </span>
            <span
              className={`text-[9px] font-mono font-bold rounded border px-1.5 py-0.5 bg-${color}/20 text-${color} border-${color}/40`}
            >
              알림
            </span>
          </div>
          <p className="text-[11px] font-sans text-foreground/90 leading-relaxed">
            <span className="tabular-nums font-semibold">
              {Math.round(alert.targetPrice).toLocaleString('ko-KR')}원
            </span>{' '}
            {isAbove ? (
              <span className="text-bull inline-flex items-center gap-0.5">
                <ArrowUp size={10} />
                상회
              </span>
            ) : (
              <span className="text-bear inline-flex items-center gap-0.5">
                <ArrowDown size={10} />
                하회
              </span>
            )}
            {' 도달!'}
          </p>
        </div>
        <button
          onClick={() => onClose(alert.id)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
