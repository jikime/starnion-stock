'use client'

import { memo } from 'react'
import { Award, Crown, Flame, Star } from 'lucide-react'
import {
  type ForeignFlowPoint,
  type MasterScore,
} from '@/hooks/use-master-scores'
import { ForeignFlowBars } from './foreign-flow-bars'


/**
 * Star Score (0~100) → 1~5개 별점 변환 (docs/02 §3 "스타니온 별점").
 * 반개 단위 지원 — 50% 이상 채워지면 꽉찬 별로 반올림.
 */
function _StarRating({
  score,
  size = 14,
}: {
  score: number
  size?: number
}) {
  const rating = Math.max(0, Math.min(5, score / 20)) // 0~100 → 0~5
  const color =
    score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#94a3b8'
  return (
    <div className="inline-flex items-center gap-0.5" title={`${score}/100점 · 별 ${rating.toFixed(1)}개`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = rating >= i + 0.5
        return (
          <Star
            key={i}
            size={size}
            fill={filled ? color : 'none'}
            stroke={color}
            strokeWidth={filled ? 0 : 1.5}
          />
        )
      })}
    </div>
  )
}
export const StarRating = memo(_StarRating)

const MASTER_CONFIG = {
  buffett: {
    Icon: Crown,
    color: '#f59e0b', // gold
    border: 'border-primary/40',
    bg: 'bg-primary/5',
    tagline: 'Safety First',      // docs/04 서브타이틀
  },
  oneill: {
    Icon: Award,
    color: '#06b6d4', // cyan
    border: 'border-secondary/40',
    bg: 'bg-secondary/5',
    tagline: 'High Momentum',
  },
  livermore: {
    Icon: Flame,
    color: '#f97316', // orange
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/5',
    tagline: 'Trend Follower',
  },
} as const


const SIGNAL_CLS: Record<string, string> = {
  BUY: 'text-bull bg-bull/10 border-bull/40',
  HOLD: 'text-secondary bg-secondary/10 border-secondary/40',
  SELL: 'text-bear bg-bear/10 border-bear/40',
}


/**
 * docs/04 § "Safety Margin" badge — 버핏 카드 전용.
 * 한국 시장 적정 PER(10배)을 기준으로 안전마진 계산.
 * margin = (target_PER / current_PER - 1) × 100
 */
function SafetyMarginBadge({ per }: { per: number }) {
  const TARGET_PER = 10
  const margin = ((TARGET_PER / per) - 1) * 100
  const isPositive = margin > 0
  const label = isPositive
    ? `+${margin.toFixed(0)}% 안전마진`
    : `${margin.toFixed(0)}% 고평가`
  return (
    <div
      className={`rounded border px-2 py-1 flex items-center justify-between text-[10px] font-mono ${
        isPositive
          ? 'border-bull/30 bg-bull/10 text-bull'
          : margin > -30
            ? 'border-secondary/30 bg-secondary/10 text-secondary'
            : 'border-bear/30 bg-bear/10 text-bear'
      }`}
    >
      <span className="text-[9px] text-muted-foreground uppercase">Safety Margin</span>
      <span className="font-bold tabular-nums">{label}</span>
    </div>
  )
}


/**
 * docs/04 § "Volume Spike" alert — 리버모어 카드 전용.
 * 당일 거래량이 20일 평균의 2배 이상이면 시각적 경고.
 */
function VolumeSpikeBadge({ ratio }: { ratio: number }) {
  if (ratio < 1.3) return null
  const isSpike = ratio >= 2.0
  const label = `${ratio.toFixed(1)}×`
  return (
    <div
      className={`rounded border px-2 py-1 flex items-center justify-between text-[10px] font-mono ${
        isSpike
          ? 'border-bear/40 bg-bear/15 text-bear animate-pulse'
          : 'border-secondary/30 bg-secondary/10 text-secondary'
      }`}
    >
      <span className="text-[9px] text-muted-foreground uppercase">
        {isSpike ? 'Volume Spike' : 'Volume'}
      </span>
      <span className="font-bold tabular-nums">
        {label} {isSpike ? '전환점 주의' : '증가'}
      </span>
    </div>
  )
}


/**
 * docs/04 § "개인 거래대금" 뱃지 — 리버모어 카드 전용.
 * 개인 순매수 = -(외인+기관). 양수면 개인 매수세, 음수면 매도세.
 */
function RetailNetBadge({ net }: { net: number }) {
  const isPositive = net > 0
  const label =
    Math.abs(net) >= 10_000
      ? `${(net / 10_000).toFixed(0)}만주`
      : `${net.toLocaleString('ko-KR')}주`
  return (
    <div
      className={`rounded border px-2 py-1 flex items-center justify-between text-[10px] font-mono ${
        isPositive
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-muted-foreground/30 bg-muted/20 text-muted-foreground'
      }`}
    >
      <span className="text-[9px] uppercase">개인 5D</span>
      <span className="font-bold tabular-nums">
        {net > 0 ? '+' : ''}
        {label} {isPositive ? '매수세' : '매도세'}
      </span>
    </div>
  )
}


function _MasterMiniCard({
  master,
  foreignFlow,
  institutionFlow,
  per,
  volumeRatio,
  retailNet5d,
}: {
  master: MasterScore
  foreignFlow?: ForeignFlowPoint[]
  institutionFlow?: ForeignFlowPoint[]
  per?: number | null
  volumeRatio?: number | null
  retailNet5d?: number | null
}) {
  const cfg =
    MASTER_CONFIG[master.name as keyof typeof MASTER_CONFIG] ??
    MASTER_CONFIG.buffett
  const Icon = cfg.Icon
  const signalCls = SIGNAL_CLS[master.signal] ?? SIGNAL_CLS.HOLD

  return (
    <div
      className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 min-w-0 flex flex-col gap-2`}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} style={{ color: cfg.color }} />
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: cfg.color }}
        >
          {master.label}
        </span>
        <span
          className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider"
          title={`docs/04 ${cfg.tagline}`}
        >
          · {cfg.tagline}
        </span>
        <span
          className={`ml-auto text-[10px] font-mono font-bold rounded border px-1.5 py-0.5 ${signalCls}`}
        >
          {master.signal}
        </span>
      </div>

      {/* 게이지 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${master.score}%`,
              background: cfg.color,
            }}
          />
        </div>
        <span className="text-base font-mono font-bold tabular-nums text-foreground min-w-[28px] text-right">
          {master.score}
        </span>
      </div>

      {/* 근거 — 세로 공간이 여유로우니 3개까지 */}
      {master.reasons.length > 0 && (
        <ul className="space-y-1 text-[10px] font-mono text-muted-foreground leading-snug">
          {master.reasons.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <span style={{ color: cfg.color }} className="shrink-0">
                ·
              </span>
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* docs/04 — 버핏 카드 전용 Safety Margin 뱃지 */}
      {master.name === 'buffett' && per != null && per > 0 && (
        <SafetyMarginBadge per={per} />
      )}

      {/* docs/04·05 — 오닐 카드 전용 외인/기관 5일 flow 막대차트 */}
      {master.name === 'oneill' && (
        <>
          {foreignFlow && foreignFlow.length > 0 && (
            <ForeignFlowBars points={foreignFlow} label="외인 5D" />
          )}
          {institutionFlow && institutionFlow.length > 0 && (
            <ForeignFlowBars points={institutionFlow} label="기관 5D" />
          )}
        </>
      )}

      {/* docs/04 — 리버모어 카드 전용 Volume Spike alert + 개인 거래대금 */}
      {master.name === 'livermore' && (
        <>
          {volumeRatio != null && <VolumeSpikeBadge ratio={volumeRatio} />}
          {retailNet5d != null && <RetailNetBadge net={retailNet5d} />}
        </>
      )}
    </div>
  )
}
export const MasterMiniCard = memo(_MasterMiniCard)
