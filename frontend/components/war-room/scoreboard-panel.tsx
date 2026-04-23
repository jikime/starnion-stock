'use client'

import { useState } from 'react'
import { Activity, AlertTriangle, BookOpen, Bot, Crown, Loader2, Target } from 'lucide-react'
import dynamic from 'next/dynamic'

const MasterPhilosophyDialog = dynamic(
  () =>
    import('./master-philosophy-dialog').then((m) => ({
      default: m.MasterPhilosophyDialog,
    })),
  { ssr: false },
)
import { IndicatorHint } from './indicator-hint'
import { useStockStore } from '@/stores/stock-store'
import { useMasterScores } from '@/hooks/use-master-scores'
import { useStockIndicators } from '@/hooks/use-stock-indicators'
import { useStockBriefing } from '@/hooks/use-stock-briefing'
import { MasterMiniCard, StarRating } from './master-scorecard'
import { MasterComparison } from './master-comparison'
import {
  AIConclusion,
  MACDCard,
  OscillatorPill,
  RSIGauge,
  StochasticCard,
} from './technical-scorecard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * 통합 분석 패널 — 3 섹션을 세로로 스택:
 *
 * 1) AI 한마디 (Nion AI briefing) — 상단 요약
 * 2) 거장 3인 스코어 (Star Score + 버핏/오닐/리버모어)
 * 3) 기술적 스코어 (RSI 게이지 + MACD/Stochastic + Williams/CCI/ADX + AI 결론)
 *
 * 기존 MasterScorecard / TechnicalScorecard 컴포넌트의 sub-parts
 * (MasterMiniCard, RSIGauge, ...) 를 재사용한다.
 */
export function ScoreboardPanel() {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [philosophyOpen, setPhilosophyOpen] = useState(false)

  const {
    data: masterData,
    isLoading: masterLoading,
    error: masterError,
  } = useMasterScores(symbol)
  const { data: ind, isLoading: indLoading } = useStockIndicators(symbol)
  const { data: briefing } = useStockBriefing(symbol)

  // 에러 감지 — 404(상장폐지) / 500(서버) / 네트워크
  const errStatus =
    masterError && 'status' in (masterError as any)
      ? ((masterError as any).status as number)
      : null
  const is404 = errStatus === 404
  const isServerError = masterError != null && !is404

  if (!selected) {
    return (
      <div className="glass-card rounded-xl border border-border h-full flex items-center justify-center text-[11px] font-mono text-muted-foreground">
        종목을 선택해주세요
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl border border-border h-full flex flex-col overflow-hidden">
      {/* 에러 다이얼로그 — 404(상장폐지) / 5xx(서버 오류) */}
      <AlertDialog
        open={(!!is404 || isServerError) && !errorDismissed}
        onOpenChange={() => setErrorDismissed(true)}
      >
        <AlertDialogContent className="border-border" style={{ background: 'rgb(20, 25, 45)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono flex items-center gap-2 text-bear">
              <AlertTriangle size={16} />
              {is404 ? '종목 데이터 오류' : '서버 오류'}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-[12px] leading-relaxed">
              <span className="text-foreground font-semibold">{selected.name}</span>{' '}
              <span className="text-muted-foreground">({selected.symbol})</span>
              <br />
              <br />
              {is404 ? (
                <>
                  데이터를 가져올 수 없습니다. 다음 사유를 확인하세요:
                  <br />
                  · 상장폐지 또는 거래정지 종목
                  <br />
                  · 잘못된 종목코드
                  <br />
                  <br />
                  다른 종목을 검색(Cmd+K)하여 진행하세요.
                </>
              ) : (
                <>
                  일시적으로 데이터를 불러올 수 없습니다.
                  {errStatus && ` (HTTP ${errStatus})`}
                  <br />
                  잠시 후 다시 시도하거나 다른 종목을 선택하세요.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="font-mono" onClick={() => setErrorDismissed(true)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MasterPhilosophyDialog
        open={philosophyOpen}
        onOpenChange={setPhilosophyOpen}
      />

      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Activity size={12} className="text-secondary" />
          종목 분석
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-bull inline-block" />
          <span className="text-[10px] text-muted-foreground font-mono">
            실시간
          </span>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-3 space-y-3">
        {/* 1) AI 한마디 ─────────────────────────────────── */}
        <section
          className="rounded-lg border border-primary/30 bg-primary/5 p-3"
          aria-label="AI 한마디"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot size={12} className="text-primary" />
            <span className="text-[10px] font-mono text-primary uppercase tracking-wider font-bold">
              Nion AI 한마디
            </span>
            {briefing?.signal_type && (
              <span
                className={`ml-auto text-[9px] font-mono font-bold rounded border px-1.5 py-0.5 ${
                  briefing.signal_type === 'BUY'
                    ? 'bg-bull/10 border-bull/40 text-bull'
                    : briefing.signal_type === 'SELL'
                      ? 'bg-bear/10 border-bear/40 text-bear'
                      : 'bg-secondary/10 border-secondary/40 text-secondary'
                }`}
              >
                {briefing.signal_type === 'BUY'
                  ? '매수'
                  : briefing.signal_type === 'SELL'
                    ? '매도'
                    : '관망'}
              </span>
            )}
          </div>

          {briefing ? (
            <>
              <p className="text-sm font-sans text-foreground leading-relaxed">
                {briefing.message || '(메시지 없음)'}
              </p>
              {(briefing.momentum != null ||
                briefing.target_price != null) && (
                <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  {briefing.momentum != null && (
                    <span>
                      모멘텀{' '}
                      <span className="text-foreground tabular-nums font-semibold">
                        {briefing.momentum}
                      </span>
                    </span>
                  )}
                  {briefing.target_price != null && (
                    <span className="flex items-center gap-0.5">
                      <Target size={9} className="text-primary" />
                      목표{' '}
                      <span className="text-primary tabular-nums font-semibold">
                        {Math.round(briefing.target_price).toLocaleString(
                          'ko-KR',
                        )}
                        원
                      </span>
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <Loader2
                size={11}
                className="animate-spin text-muted-foreground"
              />
              <span className="text-[11px] font-mono text-muted-foreground">
                AI 브리핑 생성 중...
              </span>
            </div>
          )}
        </section>

        {/* 2) 거장 3인 스코어 ─────────────────────────── */}
        <section aria-label="거장 3인 스코어" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Crown size={11} className="text-primary" />
              거장 3인 스코어
              <button
                onClick={() => setPhilosophyOpen(true)}
                className="ml-1 text-muted-foreground hover:text-primary transition-colors"
                title="거장 철학 가이드 보기"
                aria-label="거장 철학 가이드"
              >
                <BookOpen size={10} />
              </button>
            </span>
            {masterData && (
              <div className="flex items-center gap-1.5">
                <StarRating score={masterData.star_score} size={12} />
                <span
                  className="text-sm font-mono font-bold tabular-nums leading-none"
                  style={{
                    color:
                      masterData.star_score >= 70
                        ? '#22c55e'
                        : masterData.star_score >= 40
                          ? '#f59e0b'
                          : '#94a3b8',
                  }}
                >
                  {masterData.star_score}
                </span>
              </div>
            )}
          </div>

          {masterLoading || !masterData ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2
                size={12}
                className="animate-spin text-muted-foreground"
              />
              <span className="text-[11px] font-mono text-muted-foreground">
                거장 스코어 계산 중...
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <MasterMiniCard
                  master={masterData.buffett}
                  per={masterData.fundamental.per}
                />
                <MasterMiniCard
                  master={masterData.oneill}
                  foreignFlow={masterData.foreign_flow}
                  institutionFlow={masterData.institution_flow}
                />
                <MasterMiniCard
                  master={masterData.livermore}
                  volumeRatio={masterData.volume_ratio}
                  retailNet5d={masterData.retail_net_5d}
                />
              </div>

              {/* docs/03 2차 — Radar + Matrix + 매칭 해설 */}
              <MasterComparison scores={masterData} />

              {/* 펀더멘탈 */}
              <div className="grid grid-cols-4 gap-0 text-[10px] font-mono rounded border border-border/40 bg-muted/10 divide-x divide-border/30">
                <div className="flex flex-col items-center py-1.5">
                  <span className="text-[8px] text-muted-foreground uppercase">
                    <IndicatorHint hintKey="PER">PER</IndicatorHint>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {masterData.fundamental.per?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div className="flex flex-col items-center py-1.5">
                  <span className="text-[8px] text-muted-foreground uppercase">
                    <IndicatorHint hintKey="PBR">PBR</IndicatorHint>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {masterData.fundamental.pbr?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div className="flex flex-col items-center py-1.5">
                  <span className="text-[8px] text-muted-foreground uppercase">
                    <IndicatorHint hintKey="EPS">EPS</IndicatorHint>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums text-[10px]">
                    {masterData.fundamental.eps != null
                      ? masterData.fundamental.eps.toLocaleString('ko-KR')
                      : '—'}
                  </span>
                </div>
                <div className="flex flex-col items-center py-1.5">
                  <span className="text-[8px] text-muted-foreground uppercase">
                    <IndicatorHint hintKey="배당률">배당</IndicatorHint>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {masterData.fundamental.dividend_yield != null
                      ? `${masterData.fundamental.dividend_yield.toFixed(2)}%`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* docs/09 — 매크로 컨펌 노트 */}
              {masterData.macro_notes && masterData.macro_notes.length > 0 && (
                <div className="rounded border border-secondary/20 bg-secondary/5 px-2 py-1">
                  {masterData.macro_notes.map((note, i) => (
                    <p
                      key={i}
                      className="text-[9px] font-mono text-secondary leading-relaxed"
                    >
                      ⚡ {note}
                    </p>
                  ))}
                </div>
              )}

              {/* docs/05 — 데이터 출처 + docs/10 — 지연 안내 */}
              <div className="text-[8px] font-mono text-muted-foreground/50 text-center pt-1 space-y-0.5">
                <div>Data: Naver Finance · DART · KRX</div>
                <div>무료 데이터는 15~20분 지연될 수 있습니다</div>
              </div>
            </>
          )}
        </section>

        {/* 3) 기술적 스코어 ─────────────────────────── */}
        <section aria-label="기술적 스코어" className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Activity size={11} className="text-secondary" />
            기술적 스코어
          </div>

          {indLoading || !ind ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2
                size={12}
                className="animate-spin text-muted-foreground"
              />
              <span className="text-[11px] font-mono text-muted-foreground">
                기술 지표 계산 중...
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-3">
                <RSIGauge value={ind.rsi14 ?? 0} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-3">
                  <MACDCard
                    macd={ind.macd ?? 0}
                    signal={ind.macd_signal ?? 0}
                  />
                </div>
                <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-3">
                  <StochasticCard
                    k={ind.stoch_k ?? 0}
                    d={ind.stoch_d ?? 0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <OscillatorPill
                  label="Williams %R"
                  value={(ind.williams_r ?? 0).toFixed(0)}
                  status={
                    (ind.williams_r ?? 0) < -80
                      ? '과매도'
                      : (ind.williams_r ?? 0) > -20
                        ? '과매수'
                        : '중립'
                  }
                  color={
                    (ind.williams_r ?? 0) < -80
                      ? '#f59e0b'
                      : (ind.williams_r ?? 0) > -20
                        ? '#f87171'
                        : '#06b6d4'
                  }
                />
                <OscillatorPill
                  label="CCI"
                  value={(ind.cci ?? 0).toFixed(0)}
                  status={
                    (ind.cci ?? 0) < -100
                      ? '과매도'
                      : (ind.cci ?? 0) > 100
                        ? '과매수'
                        : '중립'
                  }
                  color={
                    (ind.cci ?? 0) < -100
                      ? '#f59e0b'
                      : (ind.cci ?? 0) > 100
                        ? '#f87171'
                        : '#06b6d4'
                  }
                />
                <OscillatorPill
                  label="ADX"
                  value={(ind.adx ?? 0).toFixed(0)}
                  status={(ind.adx ?? 0) > 25 ? '추세강함' : '추세약함'}
                  color={(ind.adx ?? 0) > 25 ? '#34d399' : '#556'}
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <AIConclusion ind={ind} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
