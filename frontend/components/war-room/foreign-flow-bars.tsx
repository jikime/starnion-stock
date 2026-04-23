'use client'

import { memo } from 'react'
import type { ForeignFlowPoint } from '@/hooks/use-master-scores'

/**
 * docs/04·05 — 투자자별 5일 순매수 미니 막대차트.
 * 양수(매수)=bull 색, 음수(매도)=bear 색. 최신이 오른쪽.
 * label 으로 "외인 5D" / "기관 5D" 구분.
 */
function _ForeignFlowBars({
  points,
  label = '외인 5D',
}: {
  points: ForeignFlowPoint[]
  label?: string
}) {
  if (!points || points.length === 0) return null

  // 최신 → 오래된 순으로 오므로 표시용으로 오래된 → 최신 순서로 뒤집기
  const ordered = [...points].reverse()
  const absMax = Math.max(1, ...ordered.map((p) => Math.abs(p.net)))

  const totalNet = ordered.reduce((s, p) => s + p.net, 0)
  const totalLabel =
    Math.abs(totalNet) >= 10_000
      ? `${(totalNet / 10_000).toFixed(0)}만주`
      : `${totalNet.toLocaleString('ko-KR')}주`
  const totalColor =
    totalNet > 0 ? 'text-bull' : totalNet < 0 ? 'text-bear' : 'text-muted-foreground'

  return (
    <div className="flex items-center gap-2 rounded border border-border/30 bg-muted/20 px-2 py-1.5">
      <span className="text-[9px] font-mono text-muted-foreground uppercase shrink-0">
        {label}
      </span>

      {/* 막대 5개 */}
      <div className="flex-1 flex items-end justify-around gap-0.5 h-8">
        {ordered.map((p, i) => {
          const h = (Math.abs(p.net) / absMax) * 100
          const positive = p.net >= 0
          const label =
            Math.abs(p.net) >= 10_000
              ? `${(p.net / 10_000).toFixed(0)}만`
              : p.net.toLocaleString('ko-KR')
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
              title={`${p.date}: ${p.net >= 0 ? '+' : ''}${label}주`}
            >
              <div
                className={`w-full rounded-sm ${
                  positive ? 'bg-bull/80' : 'bg-bear/80'
                }`}
                style={{
                  height: `${Math.max(h, 6)}%`,
                  minHeight: '3px',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* 누계 */}
      <span
        className={`text-[10px] font-mono tabular-nums font-bold shrink-0 ${totalColor}`}
      >
        {totalNet > 0 ? '+' : ''}
        {totalLabel}
      </span>
    </div>
  )
}
export const ForeignFlowBars = memo(_ForeignFlowBars)
