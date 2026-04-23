'use client'

import { memo } from 'react'
import { Activity, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { useStockStore } from '@/stores/stock-store'
import {
  useStockIndicators,
  type Indicators,
} from '@/hooks/use-stock-indicators'
import { IndicatorHint } from './indicator-hint'

// ── RSI Arc Gauge ─────────────────────────────────────────────────────────────

export function RSIGauge({ value }: { value: number }) {
  // 바늘 각도: -180° (왼쪽) → -90° (위) → 0° (오른쪽) 에 value 0~100 매핑
  const angle = (value / 100) * 180 - 180
  const rad = (angle * Math.PI) / 180
  const r = 38
  const cx = 52
  const cy = 52
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)

  const zone =
    value < 30 ? 'oversold' : value > 70 ? 'overbought' : 'neutral'
  const zoneColor =
    zone === 'oversold'
      ? '#f59e0b'
      : zone === 'overbought'
        ? '#f87171'
        : '#06b6d4'
  const zoneLabel =
    zone === 'oversold' ? '과매도' : zone === 'overbought' ? '과매수' : '중립'

  function describeArc(startAngleDeg: number, endAngleDeg: number) {
    const s = (startAngleDeg * Math.PI) / 180
    const e = (endAngleDeg * Math.PI) / 180
    const sx = cx + r * Math.cos(s)
    const sy = cy + r * Math.sin(s)
    const ex = cx + r * Math.cos(e)
    const ey = cy + r * Math.sin(e)
    const large = endAngleDeg - startAngleDeg > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`
  }

  // viewBox 높이를 늘려 아크 아래로 값 텍스트가 들어갈 공간을 확보
  const svgW = 104
  const svgH = 78
  const valueY = cy + 20

  return (
    <div className="flex flex-col items-center">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        aria-label={`RSI ${value}`}
      >
        <path
          d={describeArc(-180, 0)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        <path
          d={describeArc(-180, -180 + 54)}
          fill="none"
          stroke="rgba(245,158,11,0.35)"
          strokeWidth={8}
        />
        <path
          d={describeArc(-180 + 126, 0)}
          fill="none"
          stroke="rgba(248,113,113,0.35)"
          strokeWidth={8}
        />
        <path
          d={describeArc(-180 + 54, -180 + 126)}
          fill="none"
          stroke="rgba(6,182,212,0.25)"
          strokeWidth={8}
        />
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={zoneColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill={zoneColor} />
        <text
          x={cx}
          y={valueY}
          textAnchor="middle"
          fill={zoneColor}
          fontSize={13}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {value.toFixed(1)}
        </text>
      </svg>
      <div className="text-center mt-1">
        <div
          className="text-[10px] font-mono font-bold"
          style={{ color: zoneColor }}
        >
          {zoneLabel}
        </div>
        <div className="text-[9px] text-muted-foreground font-mono">
          <IndicatorHint hintKey="RSI">RSI (14)</IndicatorHint>
        </div>
      </div>
    </div>
  )
}

// ── MACD Cross ────────────────────────────────────────────────────────────────

export function MACDCard({ macd, signal }: { macd: number; signal: number }) {
  const isGolden = macd > signal
  const label = isGolden ? '골든 크로스' : '데드 크로스'
  const diff = macd - signal

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
          isGolden ? 'border-bull/60 bg-bull/10' : 'border-bear/60 bg-bear/10'
        }`}
      >
        {isGolden ? (
          <TrendingUp size={22} className="text-bull" />
        ) : (
          <TrendingDown size={22} className="text-bear" />
        )}
      </div>
      <div className="text-center">
        <div
          className={`text-[11px] font-mono font-bold ${
            isGolden ? 'text-bull' : 'text-bear'
          }`}
        >
          {label}
        </div>
        <div className="text-[9px] text-muted-foreground">
          <IndicatorHint hintKey="MACD">MACD / Signal</IndicatorHint>
        </div>
        <div
          className={`text-[10px] font-mono ${
            isGolden ? 'text-bull' : 'text-bear'
          }`}
        >
          {isGolden ? '+' : ''}
          {diff.toFixed(0)}
        </div>
      </div>
    </div>
  )
}

// ── Stochastic Bars ───────────────────────────────────────────────────────────

export function StochasticCard({ k, d }: { k: number; d: number }) {
  const zoneK = k < 20 ? 'oversold' : k > 80 ? 'overbought' : 'neutral'
  const colorK =
    zoneK === 'oversold' ? '#f59e0b' : zoneK === 'overbought' ? '#f87171' : '#34d399'
  const colorD = '#06b6d4'

  return (
    <div className="flex flex-col gap-2">
      <div className="text-center mb-1">
        <div className="text-[10px] font-mono text-muted-foreground">
          <IndicatorHint hintKey="Stochastic">Stochastic (%K/%D)</IndicatorHint>
        </div>
        <div className="text-[9px] text-muted-foreground">
          {zoneK === 'oversold'
            ? '과매도 구간'
            : zoneK === 'overbought'
              ? '과매수 구간'
              : '중립 구간'}
        </div>
      </div>
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[9px] font-mono mb-0.5">
            <span style={{ color: colorK }}>%K</span>
            <span style={{ color: colorK }}>{k.toFixed(1)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${k}%`, background: colorK }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[9px] font-mono mb-0.5">
            <span style={{ color: colorD }}>%D</span>
            <span style={{ color: colorD }}>{d.toFixed(1)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${d}%`, background: colorD }}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[8px] text-muted-foreground font-mono px-0.5">
        <span>{'과매도 <20'}</span>
        <span>{'과매수 >80'}</span>
      </div>
    </div>
  )
}

// ── Oscillator pill ───────────────────────────────────────────────────────────

function _OscillatorPill({
  label,
  value,
  status,
  color,
}: {
  label: string
  value: string
  status: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center bg-muted/30 border border-border rounded-lg px-3 py-2 min-w-[80px]">
      <span className="text-[9px] text-muted-foreground font-mono uppercase">
        <IndicatorHint hintKey={label}>{label}</IndicatorHint>
      </span>
      <span
        className="text-sm font-mono font-bold mt-0.5"
        style={{ color }}
      >
        {value}
      </span>
      <span className="text-[9px] font-mono mt-0.5" style={{ color }}>
        {status}
      </span>
    </div>
  )
}
export const OscillatorPill = memo(_OscillatorPill)

// ── AI Conclusion ─────────────────────────────────────────────────────────────

export function AIConclusion({ ind }: { ind: Indicators }) {
  const rsi = ind.rsi14 ?? 50
  const macd = ind.macd ?? 0
  const macdSignal = ind.macd_signal ?? 0
  const stochK = ind.stoch_k ?? 50

  const rsiSignal = rsi < 30
  const macdBullish = macd > macdSignal
  const stochSignal = stochK < 25

  const bullCount = [rsiSignal, macdBullish, stochSignal].filter(Boolean).length
  const techLabel =
    bullCount >= 2 ? 'Bullish' : bullCount === 1 ? 'Neutral' : 'Bearish'
  // 한국식: Bullish=빨강, Bearish=파랑
  const techColor =
    bullCount >= 2 ? '#ef4444' : bullCount === 1 ? '#06b6d4' : '#3b82f6'

  const recommendation =
    bullCount >= 2
      ? '지지선 확인 후 분할 매수 진입 고려. RSI/MACD/Stoch 3개 지표 중 2개 이상 긍정 신호.'
      : bullCount === 1
        ? '현재 관망 구간. 추가 지표 확인 필요.'
        : '기술적 신호 약세. 진입 시점 신중히 검토.'

  return (
    <div
      className={`flex-1 min-h-0 glass-card rounded-xl border flex flex-col ${
        bullCount >= 2 ? 'border-primary/40 glow-amber' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0 border-b border-border/40">
        <Zap
          size={14}
          className={bullCount >= 2 ? 'text-primary' : 'text-muted-foreground'}
        />
        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
          AI 종합 결론
        </span>
        <span
          className="ml-auto text-[10px] font-mono font-bold"
          style={{ color: techColor }}
        >
          기술적: {techLabel}
        </span>
        <Activity size={12} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <p className="text-xs text-foreground leading-relaxed font-mono">
          <span className="text-primary font-bold">Recommendation: </span>
          {recommendation}
        </p>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {rsiSignal && (
            <span className="text-[9px] bg-primary/15 border border-primary/30 text-primary rounded px-1.5 py-0.5 font-mono">
              RSI 과매도
            </span>
          )}
          {macdBullish && (
            <span className="text-[9px] bg-bull/15 border border-bull/30 text-bull rounded px-1.5 py-0.5 font-mono">
              MACD 골든크로스
            </span>
          )}
          {stochSignal && (
            <span className="text-[9px] bg-secondary/15 border border-secondary/30 text-secondary rounded px-1.5 py-0.5 font-mono">
              Stoch 과매도
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TechnicalScorecard() {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null
  const { data: ind, isLoading } = useStockIndicators(symbol)

  if (isLoading || !ind) {
    return (
      <div className="glass-card rounded-xl border border-border overflow-hidden flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        {selected ? '기술적 지표 로딩 중...' : '종목을 선택해주세요'}
      </div>
    )
  }

  const rsi14 = ind.rsi14 ?? 0
  const macd = ind.macd ?? 0
  const macdSignal = ind.macd_signal ?? 0
  const stochK = ind.stoch_k ?? 0
  const stochD = ind.stoch_d ?? 0
  const williamsR = ind.williams_r ?? 0
  const cci = ind.cci ?? 0
  const adx = ind.adx ?? 0

  return (
    <div className="glass-card rounded-xl border border-border overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-secondary" />
          <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            기술적 스코어카드
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-bull inline-block" />
          <span className="text-[10px] text-muted-foreground font-mono">
            실시간
          </span>
        </div>
      </div>

      {/*
        세로 레이아웃 (w-96 패널용):
        1) RSI 게이지 — 단독 상단
        2) MACD / Stochastic — 2 columns
        3) Williams %R / CCI / ADX — 3 pills 가로
        4) AI 결론 — full width 하단
      */}
      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-3 space-y-3">
        {/* RSI 게이지 */}
        <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-3">
          <RSIGauge value={rsi14} />
        </div>

        {/* MACD + Stochastic */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-3">
            <MACDCard macd={macd} signal={macdSignal} />
          </div>
          <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-3">
            <StochasticCard k={stochK} d={stochD} />
          </div>
        </div>

        {/* Williams / CCI / ADX — 3 pills */}
        <div className="grid grid-cols-3 gap-2">
          <OscillatorPill
            label="Williams %R"
            value={williamsR.toFixed(0)}
            status={
              williamsR < -80
                ? '과매도'
                : williamsR > -20
                  ? '과매수'
                  : '중립'
            }
            color={
              williamsR < -80
                ? '#f59e0b'
                : williamsR > -20
                  ? '#f87171'
                  : '#06b6d4'
            }
          />
          <OscillatorPill
            label="CCI"
            value={cci.toFixed(0)}
            status={cci < -100 ? '과매도' : cci > 100 ? '과매수' : '중립'}
            color={cci < -100 ? '#f59e0b' : cci > 100 ? '#f87171' : '#06b6d4'}
          />
          <OscillatorPill
            label="ADX"
            value={adx.toFixed(0)}
            status={adx > 25 ? '추세강함' : '추세약함'}
            color={adx > 25 ? '#34d399' : '#556'}
          />
        </div>

        {/* AI 결론 — full width */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <AIConclusion ind={ind} />
        </div>
      </div>
    </div>
  )
}
