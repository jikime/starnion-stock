'use client'

import { useState } from 'react'
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts'
import {
  Bell,
  ChevronRight,
  FileText,
  Info,
  Newspaper,
  Zap,
} from 'lucide-react'
import { useStockStore } from '@/stores/stock-store'
import {
  useStockNews,
  useStockSentimentHeatmap,
  useTrendingKeywords,
  type Impact,
  type NewsItem,
  type SentimentHeatmapBin,
  type TrendingKeyword,
} from '@/hooks/use-stock-news'
import {
  useMomentumScore,
  useStockSignals,
} from '@/hooks/use-stock-signals'
import { useDartDisclosures, type Disclosure } from '@/hooks/use-dart-disclosures'

// ── Impact badge config ───────────────────────────────────────────────

const IMPACT_CONFIG: Record<Impact, { cls: string; label: string }> = {
  Critical: {
    cls: 'bg-primary/20 text-primary border-primary/40',
    label: 'Critical',
  },
  High: {
    cls: 'bg-bull/20 text-bull border-bull/40',
    label: 'High',
  },
  Moderate: {
    cls: 'bg-secondary/20 text-secondary border-secondary/40',
    label: 'Moderate',
  },
}

// ── Sentiment Heatmap ────────────────────────────────────────────────

function SentimentHeatmap({
  bins,
  posPct,
  posCount,
  negCount,
}: {
  bins: SentimentHeatmapBin[]
  posPct: number
  posCount: number
  negCount: number
}) {
  const activeHours = bins.slice(8, 18)
  const negPct = 100 - posPct

  return (
    <div className="glass-card rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
          24h 센티먼트 히트맵
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-bull inline-block" />
          <span className="text-[9px] text-muted-foreground">긍정</span>
          <span className="w-2 h-2 rounded-full bg-bear ml-1 inline-block" />
          <span className="text-[9px] text-muted-foreground">부정</span>
        </div>
      </div>

      <div className="flex items-end gap-0.5 h-16 mb-2">
        {activeHours.map((bucket) => {
          const maxH = 40
          const total = bucket.positive + bucket.negative + bucket.neutral
          const posH =
            total > 0 ? Math.round((bucket.positive / total) * maxH) : 0
          const negH =
            total > 0 ? Math.round((bucket.negative / total) * maxH) : 0
          return (
            <div
              key={bucket.hour}
              className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative"
              title={`${bucket.hour}시 — 긍정 ${bucket.positive}건 부정 ${bucket.negative}건`}
            >
              {negH > 0 && (
                <div
                  className="w-full rounded-t-sm bg-bear/60"
                  style={{ height: negH }}
                />
              )}
              {posH > 0 && (
                <div
                  className="w-full rounded-t-sm bg-bull/70"
                  style={{ height: posH }}
                />
              )}
              {total === 0 && (
                <div className="w-full h-1 bg-muted/30 rounded" />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground font-mono mb-3">
        <span>08시</span>
        <span>13시</span>
        <span>18시</span>
      </div>

      <div className="flex items-stretch gap-3">
        <div
          className="w-4 rounded-full overflow-hidden flex flex-col"
          style={{ height: 80 }}
        >
          <div
            className="bg-bull/80 transition-all duration-700"
            style={{ height: `${posPct}%` }}
          />
          <div className="bg-bear/70 flex-1 transition-all duration-700" />
        </div>
        <div className="flex flex-col justify-between text-xs font-mono">
          <div>
            <div className="text-bull font-bold">{posPct}%</div>
            <div className="text-[10px] text-muted-foreground">
              긍정 ({posCount}건)
            </div>
          </div>
          <div>
            <div className="text-bear font-bold">{negPct}%</div>
            <div className="text-[10px] text-muted-foreground">
              부정 ({negCount}건)
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1 pl-2">
          <div
            className={`text-xs font-mono font-bold ${
              posPct >= 70
                ? 'text-bull'
                : posPct >= 50
                  ? 'text-secondary'
                  : 'text-bear'
            }`}
          >
            {posPct >= 70
              ? '강한 긍정 기조'
              : posPct >= 50
                ? '중립 우세'
                : '부정 우세'}
          </div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            긍정 비중 {posPct}% — AI 타점 Step 2{' '}
            {posPct >= 70 ? '충족' : '미충족'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── News Card ────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const isPos = item.sentiment === 'pos'
  const isNeg = item.sentiment === 'neg'
  const impactCfg = IMPACT_CONFIG[item.impact]

  const relativeTime = (() => {
    if (!item.published_at) return ''
    try {
      const diff = Date.now() - new Date(item.published_at).getTime()
      const mins = Math.floor(diff / 60_000)
      if (mins < 1) return '방금'
      if (mins < 60) return `${mins}분 전`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours}시간 전`
      return `${Math.floor(hours / 24)}일 전`
    } catch {
      return ''
    }
  })()

  return (
    <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group border-b border-border/40 last:border-0 relative">
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${
            isPos
              ? 'bg-bull/20 text-bull'
              : isNeg
                ? 'bg-bear/20 text-bear'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {isPos ? '호' : isNeg ? '악' : '중'}
        </div>

        <div className="flex-1 min-w-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-foreground leading-relaxed line-clamp-2 group-hover:text-primary/90 transition-colors block"
          >
            {item.headline}
          </a>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {item.source && (
              <>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {item.source}
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
              </>
            )}
            {relativeTime && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {relativeTime}
              </span>
            )}

            <span
              className={`text-[9px] rounded border px-1.5 py-0.5 font-mono font-bold ${impactCfg.cls}`}
            >
              {impactCfg.label}
            </span>

            {item.ai_summary && (
              <button
                className="ml-auto text-muted-foreground hover:text-secondary transition-colors"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                aria-label="AI 분석 보기"
              >
                <Info size={11} />
              </button>
            )}
          </div>

          {item.keywords.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {item.keywords.slice(0, 5).map((kw) => (
                <span
                  key={kw}
                  className={`text-[9px] rounded px-1.5 py-0.5 font-mono border ${
                    isPos
                      ? 'bg-bull/10 border-bull/20 text-bull/80'
                      : isNeg
                        ? 'bg-bear/10 border-bear/20 text-bear/80'
                        : 'bg-muted border-border text-muted-foreground'
                  }`}
                >
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTooltip && item.ai_summary && (
        <div
          className="absolute right-4 top-0 z-50 glass-card rounded-lg border border-secondary/40 glow-cyan p-3 max-w-[200px] pointer-events-none"
          style={{ transform: 'translateY(-110%)' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap size={9} className="text-secondary" />
            <span className="text-[10px] font-mono font-bold text-secondary">
              AI 분석
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {item.ai_summary}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Keyword Cloud ────────────────────────────────────────────────────

function KeywordCloud({ keywords }: { keywords: TrendingKeyword[] }) {
  return (
    <div className="glass-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
          트렌딩 키워드
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.length === 0 ? (
          <span className="text-[10px] font-mono text-muted-foreground">
            키워드 분석 중...
          </span>
        ) : (
          keywords.map((kw) => {
            const base =
              kw.weight === 'high'
                ? 'text-[12px] font-bold'
                : kw.weight === 'mid'
                  ? 'text-[11px] font-semibold'
                  : 'text-[10px]'
            const color =
              kw.sentiment === 'pos'
                ? 'bg-bull/10 border-bull/25 text-bull hover:bg-bull/20'
                : kw.sentiment === 'neg'
                  ? 'bg-bear/10 border-bear/25 text-bear hover:bg-bear/20'
                  : 'bg-muted border-border text-muted-foreground'
            return (
              <button
                key={kw.text}
                className={`rounded-full border px-2.5 py-1 font-mono transition-colors ${base} ${color}`}
              >
                #{kw.text}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Momentum Score ───────────────────────────────────────────────────

function ScoreRow({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-foreground w-6 text-right">
        {value}
      </span>
    </div>
  )
}

function MomentumScore({
  score,
  sentimentScore,
}: {
  score: number
  sentimentScore: number
}) {
  // 한국식: 높음=amber, 중간=cyan, 약함=파랑
  const color = score >= 70 ? '#f59e0b' : score >= 45 ? '#06b6d4' : '#3b82f6'
  const label =
    score >= 70
      ? '매우 강함'
      : score >= 55
        ? '강함'
        : score >= 45
          ? '보통'
          : '약함'

  return (
    <div className="glass-card rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
          모멘텀 스코어
        </span>
        <Zap size={14} className="text-primary" />
      </div>
      <div className="relative flex items-center justify-center h-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="90%"
            startAngle={220}
            endAngle={-40}
            data={[{ value: score, fill: color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: 'rgba(255,255,255,0.05)' }}
              cornerRadius={6}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute text-center">
          <div className="font-mono font-bold text-3xl" style={{ color }}>
            {score}
          </div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </div>
      <div className="space-y-1.5 mt-2">
        <ScoreRow label="수급" value={Math.min(100, score + 4)} color="#ef4444" />
        <ScoreRow label="기술적 지표" value={score} color={color} />
        <ScoreRow
          label="뉴스 센티먼트"
          value={sentimentScore}
          color="#06b6d4"
        />
      </div>
    </div>
  )
}

// ── AI Signal Steps ──────────────────────────────────────────────────

function StepItem({
  step,
  label,
  done,
  active,
}: {
  step: number | string
  label: string
  done: boolean
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border ${
          done
            ? active
              ? 'bg-primary border-primary text-primary-foreground'
              : 'bg-bull/20 border-bull/50 text-bull'
            : 'bg-muted border-border text-muted-foreground'
        }`}
      >
        {done ? '✓' : step}
      </div>
      <span
        className={`text-[11px] font-mono ${
          done
            ? active
              ? 'text-primary text-glow-amber'
              : 'text-bull'
            : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * 타점 상세 조건 breakdown — docs/01 3가지 매수 타점 + 수급 + 감성.
 * signal 객체가 있으면 각 조건 cond_* 를 기반으로 렌더,
 * 없으면 기본 step1/step2 만.
 */
function AISignalSteps({
  positivePct,
  signalType,
  condRsiBb,
  condTrendPullback,
  condVwapVolume,
  condSupply,
  step2Sentiment,
  confidence,
  aiConfirmation,
  aiVerdict,
}: {
  positivePct: number
  signalType: 'STRONG_BUY' | 'BUY' | 'SELL' | 'HOLD' | undefined
  condRsiBb: boolean
  condTrendPullback: boolean
  condVwapVolume: boolean
  condSupply: boolean
  step2Sentiment: boolean
  confidence: number
  aiConfirmation: string | null | undefined
  aiVerdict: 'CONFIRM' | 'CAUTION' | 'REJECT' | null | undefined
}) {
  const isStrong = signalType === 'STRONG_BUY'
  const isBuy = signalType === 'BUY' || isStrong
  const isSell = signalType === 'SELL'

  // 배지 스타일
  let badgeLabel = 'HOLD'
  let badgeCls = 'bg-muted text-muted-foreground border-border'
  if (isStrong) {
    badgeLabel = 'STRONG BUY'
    badgeCls =
      'bg-primary/30 border-primary text-primary text-glow-amber animate-pulse'
  } else if (signalType === 'BUY') {
    badgeLabel = 'BUY'
    badgeCls = 'bg-bull/20 border-bull/50 text-bull'
  } else if (isSell) {
    badgeLabel = 'SELL'
    badgeCls = 'bg-bear/20 border-bear/50 text-bear'
  }

  return (
    <div
      className={`glass-card rounded-xl border p-4 ${
        isStrong
          ? 'border-primary glow-amber'
          : isBuy
            ? 'border-bull/50'
            : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap
          size={14}
          className={isBuy ? 'text-primary' : 'text-muted-foreground'}
        />
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          AI 타점 로직
        </span>
        <span className="ml-auto text-[10px] font-mono font-bold tabular-nums text-foreground/70">
          {confidence}점
        </span>
        <span
          className={`text-[10px] font-mono font-bold rounded border px-2 py-0.5 ${badgeCls}`}
        >
          {badgeLabel}
        </span>
      </div>

      {/* docs/01 3가지 매수 타점 */}
      <div className="space-y-1.5">
        <StepItem
          step="①"
          label="역추세 (RSI<30 & BB 하단 돌파)"
          done={condRsiBb}
        />
        <StepItem
          step="②"
          label="추세 (MA 정배열 & MA20 눌림목)"
          done={condTrendPullback}
        />
        <StepItem
          step="③"
          label="세력매수 (VWAP 상회 & 거래량 2× 급증)"
          done={condVwapVolume}
        />
        <StepItem
          step="④"
          label="수급 (외인+기관 5일 순매수)"
          done={condSupply}
        />
        <StepItem
          step="⑤"
          label={`뉴스 긍정 ≥70% (현재 ${positivePct}%)`}
          done={step2Sentiment}
        />
      </div>

      {/* AI 자동 컨펌 결과 (STRONG_BUY 시) */}
      {aiConfirmation && (
        <div
          className={`mt-3 pt-3 border-t rounded-b-lg px-3 py-2 -mx-4 -mb-4 ${
            aiVerdict === 'CONFIRM'
              ? 'border-bull/30 bg-bull/5'
              : aiVerdict === 'REJECT'
                ? 'border-bear/30 bg-bear/5'
                : 'border-primary/30 bg-primary/5'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              🤖 AI 최종 컨펌
            </span>
            <span
              className={`text-[10px] font-mono font-bold rounded border px-1.5 py-0 ${
                aiVerdict === 'CONFIRM'
                  ? 'bg-bull/15 border-bull/50 text-bull'
                  : aiVerdict === 'REJECT'
                    ? 'bg-bear/15 border-bear/50 text-bear'
                    : 'bg-primary/15 border-primary/50 text-primary'
              }`}
            >
              {aiVerdict ?? 'CAUTION'}
            </span>
          </div>
          <p className="text-[11px] font-sans text-foreground leading-relaxed">
            {aiConfirmation}
          </p>
        </div>
      )}
    </div>
  )
}

// ── DART feed ────────────────────────────────────────────────────────

function DartFeed({ items }: { items: Disclosure[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const categoryColor: Record<string, string> = {
    자사주: 'bg-bull/20 text-bull',
    배당: 'bg-secondary/20 text-secondary',
    유증: 'bg-bear/20 text-bear',
    정기: 'bg-muted text-muted-foreground',
    주요: 'bg-primary/20 text-primary',
  }
  return (
    <div className="glass-card rounded-xl border border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-primary" />
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            DART 공시 알리미
          </span>
        </div>
        <Bell size={13} className="text-muted-foreground" />
      </div>
      <div className="divide-y divide-border/40">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
            최근 30일 공시 없음
          </div>
        ) : (
          items.slice(0, 6).map((item) => (
            <div
              key={item.rcept_no}
              className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() =>
                setExpanded(expanded === item.rcept_no ? null : item.rcept_no)
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] rounded px-1.5 py-0.5 font-mono font-bold ${
                    categoryColor[item.category] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.category}
                </span>
                <span className="text-xs text-foreground flex-1 truncate">
                  {item.report_nm}
                </span>
                <ChevronRight
                  size={12}
                  className={`text-muted-foreground transition-transform ${
                    expanded === item.rcept_no ? 'rotate-90' : ''
                  }`}
                />
              </div>
              {expanded === item.rcept_no && (
                <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed space-y-1">
                  <div className="font-mono">{item.rcept_dt}</div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary hover:underline font-mono"
                    >
                      DART 원문 보기 →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── News Feed ────────────────────────────────────────────────────────

function NewsFeed({ items }: { items: NewsItem[] }) {
  return (
    <div className="glass-card rounded-xl border border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-secondary" />
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            AI 뉴스 피드 (Impact)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-bull inline-block" />
          <span className="text-[10px] text-muted-foreground font-mono">
            실시간
          </span>
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
            뉴스 로딩 중...
          </div>
        ) : (
          items.map((item, idx) => (
            <NewsCard key={`${idx}-${item.id}`} item={item} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main sidebar ─────────────────────────────────────────────────────

export function IntelligenceSidebar() {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null

  const { data: news = [] } = useStockNews(symbol, 10)
  const { data: heatmapBins = [] } = useStockSentimentHeatmap(symbol)
  const { data: keywords = [] } = useTrendingKeywords(symbol)
  const { data: signal } = useStockSignals(symbol)
  const { data: momentum } = useMomentumScore(symbol)
  const { data: disclosures = [] } = useDartDisclosures(symbol)

  const posCount = news.filter((n) => n.sentiment === 'pos').length
  const negCount = news.filter((n) => n.sentiment === 'neg').length
  const total = news.length || 1
  const positivePct = Math.round((posCount / total) * 100)

  const step2 = signal?.step2_sentiment ?? false
  const momentumScore = momentum?.score ?? 50

  // Fill empty heatmap for consistent UI
  const bins: SentimentHeatmapBin[] =
    heatmapBins.length === 24
      ? heatmapBins
      : Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          positive: 0,
          negative: 0,
          neutral: 0,
        }))

  return (
    <aside className="flex flex-col gap-3 h-full overflow-y-auto pr-0.5 thin-scrollbar">
      <AISignalSteps
        positivePct={positivePct}
        signalType={signal?.type}
        condRsiBb={signal?.cond_rsi_bb ?? false}
        condTrendPullback={signal?.cond_trend_pullback ?? false}
        condVwapVolume={signal?.cond_vwap_volume ?? false}
        condSupply={signal?.cond_supply ?? false}
        step2Sentiment={step2}
        confidence={signal?.confidence ?? 0}
        aiConfirmation={signal?.ai_confirmation}
        aiVerdict={signal?.ai_verdict}
      />

      {/*
        Claude 심층 분석 트리거는 우측 레일의 🤖 Bot 아이콘으로 접근.
        중복 제거 위해 여기서 삭제.
      */}

      <SentimentHeatmap
        bins={bins}
        posPct={positivePct}
        posCount={posCount}
        negCount={negCount}
      />

      <MomentumScore score={momentumScore} sentimentScore={positivePct} />

      <KeywordCloud keywords={keywords} />

      <NewsFeed items={news} />

      <DartFeed items={disclosures} />
    </aside>
  )
}
