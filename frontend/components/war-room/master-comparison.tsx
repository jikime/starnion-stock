'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import type { MasterScores } from '@/hooks/use-master-scores'
import { Sparkles } from 'lucide-react'

/**
 * docs/03 § 2차 UI — 3인 스코어 비교 시각화.
 *
 * 1) Radar (Spider) 차트 — 재무가치 / 성장·모멘텀 / 추세·돌파 3축
 * 2) 매칭 해설 (백엔드 commentary 표시)
 * 3) Comparative Matrix — 거장별 핵심 지표 × 현재값 × 기준 통과 여부
 */

// ──────────────────────────────────────────────────────────────────────
// Radar — 3축 스파이더 차트
// ──────────────────────────────────────────────────────────────────────

function MasterRadar({ scores }: { scores: MasterScores }) {
  const data = [
    { axis: '재무가치', score: scores.buffett.score, fullMark: 100 },
    { axis: '성장·모멘텀', score: scores.oneill.score, fullMark: 100 },
    { axis: '추세·돌파', score: scores.livermore.score, fullMark: 100 },
  ]
  const starColor =
    scores.star_score >= 70
      ? '#22c55e'
      : scores.star_score >= 40
        ? '#f59e0b'
        : '#94a3b8'

  return (
    <div className="w-full h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          cx="50%"
          cy="52%"
          outerRadius="70%"
          data={data}
          margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
        >
          <PolarGrid
            stroke="var(--border)"
            strokeOpacity={0.5}
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="axis"
            tick={{
              fill: 'var(--muted-foreground)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke={starColor}
            fill={starColor}
            fillOpacity={0.3}
            strokeWidth={1.5}
            dot={{ r: 2.5, fill: starColor, stroke: starColor }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Matrix — 거장별 핵심 지표 비교표
// ──────────────────────────────────────────────────────────────────────

type MatrixRow = {
  label: string
  value: string
  pass: 'pass' | 'fail' | 'neutral'
  criterion: string
}

function _fmt(v: number | null | undefined, suffix = '', digits = 1): string {
  if (v == null) return '—'
  return `${v.toFixed(digits)}${suffix}`
}

function buildMatrix(scores: MasterScores): {
  title: string
  color: string
  rows: MatrixRow[]
}[] {
  const f = scores.fundamental

  // Buffett: ROE > 15, 부채비율 < 80, PER < 15, 배당 > 3
  const buffettRows: MatrixRow[] = [
    {
      label: 'ROE',
      value: _fmt(f.roe, '%'),
      criterion: '> 15%',
      pass:
        f.roe == null
          ? 'neutral'
          : f.roe >= 15
            ? 'pass'
            : f.roe >= 10
              ? 'neutral'
              : 'fail',
    },
    {
      label: '부채비율',
      value: _fmt(f.debt_ratio, '%', 0),
      criterion: '< 80%',
      pass:
        f.debt_ratio == null
          ? 'neutral'
          : f.debt_ratio < 80
            ? 'pass'
            : f.debt_ratio < 150
              ? 'neutral'
              : 'fail',
    },
    {
      label: 'PER',
      value: _fmt(f.per, '배'),
      criterion: '< 15배',
      pass:
        f.per == null
          ? 'neutral'
          : f.per < 15
            ? 'pass'
            : f.per < 25
              ? 'neutral'
              : 'fail',
    },
    {
      label: '배당률',
      value: _fmt(f.dividend_yield, '%', 2),
      criterion: '> 3%',
      pass:
        f.dividend_yield == null
          ? 'neutral'
          : f.dividend_yield >= 3
            ? 'pass'
            : f.dividend_yield >= 1.5
              ? 'neutral'
              : 'fail',
    },
  ]

  // O'Neil: 순이익 YoY > 25%, 매출 YoY > 10%, ROE > 15, (RSI, 신고가는 지표에서)
  const oneillRows: MatrixRow[] = [
    {
      label: '순이익 YoY',
      value: _fmt(f.net_income_growth, '%', 0),
      criterion: '> 25%',
      pass:
        f.net_income_growth == null
          ? 'neutral'
          : f.net_income_growth > 25
            ? 'pass'
            : f.net_income_growth > 10
              ? 'neutral'
              : 'fail',
    },
    {
      label: '매출 YoY',
      value: _fmt(f.revenue_growth, '%', 0),
      criterion: '> 10%',
      pass:
        f.revenue_growth == null
          ? 'neutral'
          : f.revenue_growth > 10
            ? 'pass'
            : f.revenue_growth > 5
              ? 'neutral'
              : 'fail',
    },
    {
      label: 'ROE',
      value: _fmt(f.roe, '%'),
      criterion: '> 15%',
      pass:
        f.roe == null ? 'neutral' : f.roe >= 15 ? 'pass' : 'neutral',
    },
  ]

  // Livermore는 지표 기반 — reasons에서 추출하거나 MA50/MA200 참조.
  // 여기서는 해당 거장 스코어 구성 요소를 reasons 기반으로 요약
  const liveReasonRows: MatrixRow[] = scores.livermore.reasons
    .slice(0, 3)
    .map((r) => ({
      label: r.split(' ')[0] || '추세',
      value: r,
      criterion: '',
      pass: 'pass',
    }))

  return [
    { title: '버핏 (재무)', color: '#f59e0b', rows: buffettRows },
    { title: '오닐 (성장)', color: '#06b6d4', rows: oneillRows },
    {
      title: '리버모어 (추세)',
      color: '#f97316',
      rows:
        liveReasonRows.length > 0
          ? liveReasonRows
          : [{ label: '추세', value: '계산 중', criterion: '', pass: 'neutral' }],
    },
  ]
}

function MasterMatrix({ scores }: { scores: MasterScores }) {
  const groups = buildMatrix(scores)
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {groups.map((g) => (
        <div
          key={g.title}
          className="rounded border border-border/40 bg-muted/10 overflow-hidden"
        >
          <div
            className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border-b border-border/30"
            style={{ color: g.color, background: `${g.color}10` }}
          >
            {g.title}
          </div>
          <div className="divide-y divide-border/20">
            {g.rows.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 text-[10px] font-mono"
              >
                <span className="text-muted-foreground w-16 truncate shrink-0">
                  {row.label}
                </span>
                <span className="flex-1 text-foreground tabular-nums truncate">
                  {row.value}
                </span>
                {row.criterion && (
                  <span className="text-muted-foreground text-[9px] tabular-nums shrink-0">
                    {row.criterion}
                  </span>
                )}
                <span
                  className={`shrink-0 text-[11px] leading-none ${
                    row.pass === 'pass'
                      ? 'text-bull'
                      : row.pass === 'fail'
                        ? 'text-bear'
                        : 'text-muted-foreground'
                  }`}
                  aria-label={row.pass}
                >
                  {row.pass === 'pass'
                    ? '✓'
                    : row.pass === 'fail'
                      ? '✕'
                      : '·'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// 메인 — Radar + Commentary + Matrix 스택
// ──────────────────────────────────────────────────────────────────────

export function MasterComparison({ scores }: { scores: MasterScores }) {
  return (
    <div className="space-y-2">
      {/* Radar */}
      <div className="rounded-lg border border-border/40 bg-muted/10 px-1 py-1">
        <MasterRadar scores={scores} />
      </div>

      {/* AI 매칭 해설 */}
      {scores.commentary && (
        <div className="rounded border border-primary/20 bg-primary/5 px-2 py-1.5 flex items-start gap-1.5">
          <Sparkles
            size={10}
            className="text-primary mt-0.5 shrink-0"
          />
          <p className="text-[10px] font-mono text-foreground/90 leading-snug">
            {scores.commentary}
          </p>
        </div>
      )}

      {/* Matrix */}
      <MasterMatrix scores={scores} />
    </div>
  )
}
