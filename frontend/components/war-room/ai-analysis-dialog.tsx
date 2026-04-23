'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  useAIAnalysisHistory,
  useDeleteAIAnalysis,
  useGenerateAIAnalysis,
  type AIAnalysis,
} from '@/hooks/use-ai-analysis'
import { useStockStore } from '@/stores/stock-store'

interface AIAnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DecisionBadge({ decision }: { decision: AIAnalysis['decision'] }) {
  const config = {
    BUY: {
      Icon: TrendingUp,
      label: '매수',
      cls: 'bg-bull/15 text-bull border-bull/40',
    },
    SELL: {
      Icon: TrendingDown,
      label: '매도',
      cls: 'bg-bear/15 text-bear border-bear/40',
    },
    HOLD: {
      Icon: AlertCircle,
      label: '관망',
      cls: 'bg-secondary/15 text-secondary border-secondary/40',
    },
  }[decision]
  const Icon = config.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold rounded border px-2 py-0.5 ${config.cls}`}
    >
      <Icon size={11} />
      {config.label}
    </span>
  )
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function AIAnalysisCard({
  analysis,
  defaultExpanded,
  onDelete,
}: {
  analysis: AIAnalysis
  defaultExpanded: boolean
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        <DecisionBadge decision={analysis.decision} />
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {analysis.confidence}%
        </span>
        {analysis.target_price != null && (
          <span className="text-[11px] font-mono text-primary flex items-center gap-0.5">
            <Target size={10} />
            {Math.round(analysis.target_price).toLocaleString('ko-KR')}원
          </span>
        )}
        <span className="flex-1 min-w-0 text-xs font-mono text-foreground truncate">
          {analysis.summary}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/70 tabular-nums shrink-0">
          {formatDateTime(analysis.created_at)}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border/40 bg-background/40 space-y-3">
          {analysis.price_at_analysis != null && (
            <div className="text-[10px] font-mono text-muted-foreground">
              분석 시점 현재가:{' '}
              <span className="text-foreground">
                {Math.round(analysis.price_at_analysis).toLocaleString('ko-KR')}원
              </span>
              {analysis.rsi != null && (
                <>
                  {' · '}RSI:{' '}
                  <span className="text-foreground">
                    {analysis.rsi.toFixed(1)}
                  </span>
                </>
              )}
              {analysis.macd_state && (
                <>
                  {' · '}MACD:{' '}
                  <span className="text-foreground">
                    {analysis.macd_state === 'golden'
                      ? '골든크로스'
                      : analysis.macd_state === 'dead'
                        ? '데드크로스'
                        : '중립'}
                  </span>
                </>
              )}
              {' · '}뉴스{' '}
              <span className="text-foreground">{analysis.news_count}건</span>
            </div>
          )}

          {analysis.positives.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-bull mb-1.5">
                <CheckCircle2 size={11} />
                긍정 요인
              </div>
              <ul className="space-y-1 pl-4">
                {analysis.positives.map((p, i) => (
                  <li
                    key={i}
                    className="text-xs font-mono text-foreground leading-relaxed list-disc marker:text-bull/70"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.risks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-bear mb-1.5">
                <XCircle size={11} />
                리스크
              </div>
              <ul className="space-y-1 pl-4">
                {analysis.risks.map((r, i) => (
                  <li
                    key={i}
                    className="text-xs font-mono text-foreground leading-relaxed list-disc marker:text-bear/70"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.reasoning && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary mb-1.5">
                <Sparkles size={11} />
                투자 의견
              </div>
              <p className="text-sm font-sans text-foreground leading-relaxed whitespace-pre-wrap">
                {analysis.reasoning}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(analysis.id)
              }}
              className="flex items-center gap-1 text-[10px] font-mono text-bear hover:text-bear/80 transition-colors"
            >
              <Trash2 size={10} />
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AIAnalysisDialog({
  open,
  onOpenChange,
}: AIAnalysisDialogProps) {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null

  const { data: history = [], isLoading } = useAIAnalysisHistory(symbol, open)
  const generateMutation = useGenerateAIAnalysis(symbol)
  const deleteMutation = useDeleteAIAnalysis(symbol)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!symbol) return
    try {
      await generateMutation.mutateAsync()
    } catch {
      // 에러는 mutation.error 상태로 표시됨
    }
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    try {
      await deleteMutation.mutateAsync(deleteTargetId)
    } finally {
      setDeleteTargetId(null)
    }
  }

  const latestId = history[0]?.id ?? null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border-border" style={{ background: 'rgb(20, 25, 45)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <Bot size={16} className="text-primary" />
              Claude AI 심층 분석
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px]">
              {selected ? (
                <>
                  <span className="text-foreground font-semibold">
                    {selected.name}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    ({selected.symbol})
                  </span>
                  {' · '}기술 지표 + 뉴스 + 공시를 종합해 Claude가 투자 의견을 제시합니다.
                </>
              ) : (
                '종목을 먼저 선택해주세요'
              )}
            </DialogDescription>
          </DialogHeader>

          {/* 상단: 새 분석 버튼 */}
          <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50">
            <Button
              onClick={handleGenerate}
              disabled={!symbol || generateMutation.isPending}
              className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <RefreshCcw size={14} />
                  새 분석 요청
                </>
              )}
            </Button>
            <span className="text-[10px] font-mono text-muted-foreground">
              저장된 분석: {history.length}건
            </span>
          </div>

          {/* 에러 메시지 */}
          {generateMutation.isError && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2">
              <p className="text-[11px] font-mono text-bear">
                분석 요청 실패:{' '}
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : '알 수 없는 오류'}
              </p>
            </div>
          )}

          {/* 히스토리 목록 */}
          <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar space-y-2 pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-[11px] font-mono text-muted-foreground">
                <Loader2 size={14} className="animate-spin mr-2" />
                이력 로딩 중...
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bot size={28} className="text-muted-foreground/40 mb-2" />
                <p className="text-[11px] font-mono text-muted-foreground">
                  아직 저장된 분석이 없습니다.
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/70 mt-1">
                  위의 "새 분석 요청" 버튼을 눌러 시작하세요.
                </p>
              </div>
            ) : (
              history.map((analysis) => (
                <AIAnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  defaultExpanded={analysis.id === latestId}
                  onDelete={(id) => setDeleteTargetId(id)}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
      >
        <AlertDialogContent className="border-border" style={{ background: 'rgb(20, 25, 45)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-bear">
              AI 분석 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-[11px]">
              이 분석을 삭제하면 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="font-mono"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="font-mono bg-bear text-white hover:bg-bear/90"
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
