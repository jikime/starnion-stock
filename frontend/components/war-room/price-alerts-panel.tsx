'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, BellRing, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { useAlertStore, type PriceAlert } from '@/stores/alert-store'
import { useStockStore } from '@/stores/stock-store'
import { apiGet } from '@/lib/api-client'
import type { TickerItem } from '@/hooks/use-market-tickers'

/**
 * 가격 도달 알림 패널.
 *
 * - 현재 선택 종목 기준으로 알림 추가 가능 (상회/하회 + 가격)
 * - 전체 알림 목록 표시 (트리거된 것은 회색)
 * - 실시간 가격 비교 (alert-monitor 가 별도 수행)
 */
export function PriceAlertsPanel() {
  const selected = useStockStore((s) => s.selected)
  const alerts = useAlertStore((s) => s.alerts)
  const addAlert = useAlertStore((s) => s.addAlert)
  const removeAlert = useAlertStore((s) => s.removeAlert)

  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState<'above' | 'below'>('above')

  // 선택 종목 현재가 — 입력 placeholder 용
  const { data: currentTicker } = useQuery({
    queryKey: ['alert-current-price', selected?.symbol],
    queryFn: () =>
      apiGet<TickerItem[]>(`/market/tickers?symbols=${selected?.symbol}`),
    enabled: Boolean(selected?.symbol),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const currentPrice = currentTicker?.[0]?.current_price ?? null

  const handleAdd = () => {
    if (!selected) return
    const price = parseFloat(targetPrice)
    if (isNaN(price) || price <= 0) return
    addAlert({
      symbol: selected.symbol,
      stockName: selected.name,
      targetPrice: price,
      direction,
    })
    setTargetPrice('')
  }

  const activeAlerts = alerts.filter((a) => !a.triggered)
  const triggeredAlerts = alerts.filter((a) => a.triggered)

  return (
    <div className="glass-card rounded-xl border border-border h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Bell size={12} className="text-primary" />
          가격 알림
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {activeAlerts.length}개 활성
        </span>
      </div>

      {/* 알림 추가 폼 */}
      {selected && (
        <div className="px-3 py-2 border-b border-border/30 space-y-2 shrink-0">
          <div className="text-[10px] font-mono text-muted-foreground">
            <span className="text-foreground font-semibold">{selected.name}</span>
            <span className="ml-1">({selected.symbol})</span>
            {currentPrice && (
              <span className="ml-2 tabular-nums">
                현재 {Math.round(currentPrice).toLocaleString('ko-KR')}원
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDirection('above')}
              className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                direction === 'above'
                  ? 'bg-bull/20 text-bull border-bull/40'
                  : 'border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowUp size={10} />
              상회
            </button>
            <button
              onClick={() => setDirection('below')}
              className={`flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                direction === 'below'
                  ? 'bg-bear/20 text-bear border-bear/40'
                  : 'border-border/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowDown size={10} />
              하회
            </button>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={currentPrice ? String(Math.round(currentPrice)) : '가격'}
              className="flex-1 h-7 px-2 rounded bg-muted/30 border border-border text-[11px] font-mono tabular-nums focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!targetPrice || parseFloat(targetPrice) <= 0}
              className="flex items-center gap-0.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-primary text-[10px] font-mono rounded px-2"
              title="알림 추가"
            >
              <Plus size={10} />
              추가
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        {alerts.length === 0 ? (
          <div className="p-4 text-center">
            <Bell size={24} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              설정된 알림이 없습니다.
              <br />
              종목 선택 후 가격을 입력하여 알림을 추가하세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {/* 활성 알림 먼저 */}
            {activeAlerts.map((a) => (
              <AlertRow key={a.id} alert={a} onRemove={removeAlert} />
            ))}
            {/* 트리거된 알림 (회색) */}
            {triggeredAlerts.length > 0 && (
              <li className="px-3 py-1.5 text-[9px] font-mono text-muted-foreground bg-muted/20">
                트리거된 알림 ({triggeredAlerts.length})
              </li>
            )}
            {triggeredAlerts.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onRemove={removeAlert}
                dimmed
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


function AlertRow({
  alert,
  onRemove,
  dimmed,
}: {
  alert: PriceAlert
  onRemove: (id: string) => void
  dimmed?: boolean
}) {
  const dirColor = alert.direction === 'above' ? 'text-bull' : 'text-bear'
  return (
    <li
      className={`group flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      <span className={`shrink-0 ${dirColor}`}>
        {alert.direction === 'above' ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-display font-bold text-foreground truncate">
            {alert.stockName}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
            {alert.symbol}
          </span>
          {alert.triggered && (
            <BellRing size={10} className="text-primary ml-auto" />
          )}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          <span className={`${dirColor} font-semibold tabular-nums`}>
            {Math.round(alert.targetPrice).toLocaleString('ko-KR')}원
          </span>
          <span className="ml-1">
            {alert.direction === 'above' ? '상회 시' : '하회 시'}
          </span>
        </div>
      </div>
      <button
        onClick={() => onRemove(alert.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-bear transition-all"
        aria-label="알림 삭제"
      >
        <Trash2 size={11} />
      </button>
    </li>
  )
}
