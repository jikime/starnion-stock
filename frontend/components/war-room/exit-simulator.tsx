'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  Loader2,
  Shield,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import { useStockStore } from '@/stores/stock-store'
import { useTradeLog } from '@/hooks/use-trade-log'
import {
  useExitSimulation,
  type ExitSignal,
} from '@/hooks/use-exit-simulation'

const SIGNAL_ICON: Record<string, typeof Flame> = {
  stoploss: TrendingDown,
  trend: AlertTriangle,
  overheat: Flame,
  target: CheckCircle2,
}

const REC_CONFIG = {
  HOLD: {
    label: '보유',
    cls: 'text-bull bg-bull/10 border-bull/40',
  },
  WATCH: {
    label: '관망',
    cls: 'text-secondary bg-secondary/10 border-secondary/40',
  },
  SELL: {
    label: '매도',
    cls: 'text-bear bg-bear/10 border-bear/40',
  },
} as const


function SignalPill({ sig }: { sig: ExitSignal }) {
  const Icon = SIGNAL_ICON[sig.name] ?? Flame
  return (
    <div
      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono ${
        sig.triggered
          ? 'border-bear/50 bg-bear/10 text-bear'
          : 'border-border/40 bg-muted/20 text-muted-foreground'
      }`}
      title={sig.detail}
    >
      <Icon size={9} />
      <span>{sig.label}</span>
    </div>
  )
}


/**
 * docs/06 §4 — 감정 가드: 뇌동매매 방지.
 * "공포 때문인가, 로직 때문인가?" 를 데이터로 판단.
 */
function EmotionGuard({
  triggeredCount,
  sellCount,
  pnlPct,
}: {
  triggeredCount: number
  sellCount: number
  pnlPct: number
}) {
  const [open, setOpen] = useState(false)

  // 로직 기반 매도 근거 수
  const logicScore = triggeredCount + sellCount
  const isFearLikely = logicScore <= 1 && pnlPct < 0

  // docs/07 §5: 구체적 매도 비율 제안
  let message: string
  let actionAdvice: string

  if (isFearLikely) {
    message = `매도 시그널 ${triggeredCount}개, 거장 SELL ${sellCount}명 — 로직 기반 근거가 부족합니다.`
    actionAdvice = '공포에 의한 뇌동매매 주의. 현재는 보유를 유지하세요.'
  } else if (logicScore >= 4) {
    message = `매도 시그널 ${triggeredCount}개 + 거장 SELL ${sellCount}명 — 강한 매도 근거.`
    actionAdvice = '전량 매도를 권장합니다. 계획대로 실행하세요.'
  } else if (logicScore >= 3) {
    message = `매도 시그널 ${triggeredCount}개 + 거장 SELL ${sellCount}명 — 충분한 매도 근거.`
    actionAdvice =
      pnlPct > 0
        ? '70% 매도로 수익 확정 + 30% 보유로 추가 상승 대비를 권장합니다.'
        : '50% 매도로 손실 제한 + 50% 보유로 반등 가능성을 열어두세요.'
  } else {
    message = `매도 시그널 ${triggeredCount}개, 거장 SELL ${sellCount}명 — 부분적 근거.`
    actionAdvice =
      pnlPct > 0
        ? '30% 분할 매도로 일부 수익을 확정하고, 나머지는 추세를 지켜보세요.'
        : '확신이 없다면 보유 유지. 손절선 도달 시 기계적으로 실행하세요.'
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center gap-1.5 text-left hover:bg-primary/10 transition-colors"
      >
        <Shield size={12} className="text-primary shrink-0" />
        <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider">
          감정 가드
        </span>
        <span className="text-[9px] font-mono text-muted-foreground ml-auto">
          {open ? '접기' : '공포 vs 로직?'}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 border-t border-primary/20">
          <p className="text-[11px] font-sans text-foreground/90 leading-relaxed mt-2">
            {message}
          </p>
          <p className="mt-1.5 text-[10px] font-mono text-primary leading-relaxed font-semibold">
            → {actionAdvice}
          </p>
          {isFearLikely && (
            <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
              Nion AI: 손절선에 도달하지 않았고, 추세도 유지 중이라면 — 감정이 아닌 규칙에 따르세요.
            </p>
          )}
        </div>
      )}
    </div>
  )
}


export function ExitSimulator() {
  const selected = useStockStore((s) => s.selected)
  const { data: trades = [] } = useTradeLog()
  const [manualEntry, setManualEntry] = useState<string>('')
  const [customSL, setCustomSL] = useState<string>('')
  const [customTP, setCustomTP] = useState<string>('')

  // 현재 선택 종목의 보유분(open) 중 첫 건의 entry_price / date 기본값
  const heldTrade = useMemo(() => {
    if (!selected) return null
    return trades.find(
      (t) => t.symbol === selected.symbol && t.status === 'open',
    ) ?? null
  }, [trades, selected])

  const heldEntryPrice = heldTrade?.entry_price ?? null
  const heldEntryDate = heldTrade?.date ?? null

  const effectiveEntry = useMemo<number | null>(() => {
    const m = parseFloat(manualEntry)
    if (!isNaN(m) && m > 0) return m
    return heldEntryPrice
  }, [manualEntry, heldEntryPrice])

  // docs/06 §1①: 오닐 3주 급등 예외를 위해 매수일 전달
  const effectiveEntryDate = manualEntry ? null : heldEntryDate

  // docs/07 §2: 커스텀 손절/익절 %
  const parsedSL = parseFloat(customSL)
  const parsedTP = parseFloat(customTP)
  const effectiveSL = !isNaN(parsedSL) && parsedSL !== 0 ? parsedSL : null
  const effectiveTP = !isNaN(parsedTP) && parsedTP > 0 ? parsedTP : null

  const { data, isLoading } = useExitSimulation(
    selected?.symbol ?? null,
    effectiveEntry,
    effectiveEntryDate,
    effectiveSL,
    effectiveTP,
  )

  if (!selected) {
    return (
      <div className="glass-card rounded-xl border border-border h-full flex items-center justify-center text-[11px] font-mono text-muted-foreground">
        종목을 선택해주세요
      </div>
    )
  }

  const urgencyColor = data
    ? data.urgency_score >= 70
      ? '#ef4444'
      : data.urgency_score >= 40
        ? '#06b6d4'
        : '#22c55e'
    : '#94a3b8'

  return (
    <div className="glass-card rounded-xl border border-border h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Gauge size={12} className="text-primary" />
          매도 시뮬레이터
        </h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-3 space-y-3">
        {/* 매수가 입력 */}
        <div>
          <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">
            매수가
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={manualEntry}
              onChange={(e) => setManualEntry(e.target.value)}
              placeholder={
                heldEntryPrice != null
                  ? `보유: ${heldEntryPrice.toLocaleString('ko-KR')}`
                  : '매수가 입력'
              }
              className="flex-1 h-7 px-2 rounded bg-muted/30 border border-border text-[11px] font-mono tabular-nums focus:outline-none focus:border-primary"
            />
            <span className="text-[10px] font-mono text-muted-foreground">
              원
            </span>
          </div>
        </div>

        {/* docs/07 §2: 커스텀 손절/익절 % */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">
              손절 %
            </label>
            <input
              type="number"
              value={customSL}
              onChange={(e) => setCustomSL(e.target.value)}
              placeholder="-7"
              className="w-full h-7 px-2 rounded bg-muted/30 border border-border text-[11px] font-mono tabular-nums focus:outline-none focus:border-bear"
            />
          </div>
          <div>
            <label className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1 block">
              익절 %
            </label>
            <input
              type="number"
              value={customTP}
              onChange={(e) => setCustomTP(e.target.value)}
              placeholder="20"
              className="w-full h-7 px-2 rounded bg-muted/30 border border-border text-[11px] font-mono tabular-nums focus:outline-none focus:border-bull"
            />
          </div>
        </div>

        {effectiveEntry == null ? (
          <div className="py-6 text-center text-[11px] font-mono text-muted-foreground leading-relaxed">
            매수 기록이 없는 종목입니다.
            <br />
            매수가를 입력하거나
            <br />
            매수 기록을 추가하세요.
          </div>
        ) : isLoading || !data ? (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
            <span className="text-[11px] font-mono text-muted-foreground">
              시뮬레이션 계산 중...
            </span>
          </div>
        ) : (
          <>
            {/* 평가손익 + 권고 배지 */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  평가손익
                </span>
                <span
                  className={`text-[10px] font-mono font-bold rounded border px-2 py-0.5 ${
                    REC_CONFIG[data.recommendation].cls
                  }`}
                >
                  {REC_CONFIG[data.recommendation].label}
                </span>
              </div>
              <div
                className={`text-xl font-mono font-bold tabular-nums ${
                  data.pnl >= 0 ? 'text-bull' : 'text-bear'
                }`}
              >
                {data.pnl >= 0 ? '+' : ''}
                {Math.round(data.pnl).toLocaleString('ko-KR')}원
              </div>
              <div
                className={`text-xs font-mono tabular-nums ${
                  data.pnl >= 0 ? 'text-bull' : 'text-bear'
                }`}
              >
                ({data.pnl_pct >= 0 ? '+' : ''}
                {data.pnl_pct.toFixed(2)}%)
              </div>

              {/* Urgency 게이지 크게 */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    Exit Urgency
                  </span>
                  <span
                    className="text-lg font-mono font-bold tabular-nums"
                    style={{ color: urgencyColor }}
                  >
                    {data.urgency_score}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${data.urgency_score}%`,
                      background: urgencyColor,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 4단계 시그널 — 세로 스택 */}
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
                4단계 시그널
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {data.signals.map((s) => (
                  <SignalPill key={s.name} sig={s} />
                ))}
              </div>
              {/* 활성 시그널 상세 */}
              {data.signals
                .filter((s) => s.triggered)
                .map((s) => (
                  <p
                    key={`detail-${s.name}`}
                    className="mt-1.5 text-[10px] font-mono text-bear leading-relaxed"
                  >
                    · {s.detail}
                  </p>
                ))}
            </div>

            {/* 거장 3인 결정 — 카드 형태 */}
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
                거장별 판단
              </div>
              <div className="space-y-1.5">
                {data.master_opinions.map((op) => (
                  <div
                    key={op.name}
                    className={`rounded-lg border p-2 ${
                      op.decision === 'SELL'
                        ? 'border-bear/30 bg-bear/5'
                        : 'border-bull/30 bg-bull/5'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`flex items-center gap-0.5 text-[10px] font-mono font-bold rounded border px-1.5 py-0 ${
                          op.decision === 'SELL'
                            ? 'text-bear border-bear/40 bg-bear/10'
                            : 'text-bull border-bull/40 bg-bull/10'
                        }`}
                      >
                        {op.decision === 'SELL' && (
                          <XCircle size={10} />
                        )}
                        {op.decision}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-foreground">
                        {op.label}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                      {op.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* docs/06 §4 — 감정 가드 (뇌동매매 방지) */}
            <EmotionGuard
              triggeredCount={data.signals.filter((s) => s.triggered).length}
              sellCount={data.master_opinions.filter((o) => o.decision === 'SELL').length}
              pnlPct={data.pnl_pct}
            />
          </>
        )}
      </div>
    </div>
  )
}
