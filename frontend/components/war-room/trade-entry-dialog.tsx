'use client'

import { useEffect, useState, type SyntheticEvent } from 'react'
import { Target } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useStockStore } from '@/stores/stock-store'
import { useCreateTrade, type TradeEntry } from '@/hooks/use-trade-log'
import { useStockCandles } from '@/hooks/use-stock-candles'

type Emotion = TradeEntry['emotion']

const EMOTIONS: { value: Emotion; label: string; tone: string }[] = [
  { value: '확신', label: '확신', tone: 'text-bull' },
  { value: '흥분', label: '흥분', tone: 'text-primary' },
  { value: '중립', label: '중립', tone: 'text-secondary' },
  { value: '불안', label: '불안', tone: 'text-bear' },
]

interface TradeEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TradeEntryDialog({
  open,
  onOpenChange,
}: TradeEntryDialogProps) {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null

  // 다이얼로그가 열려있을 때만 candles fetch 해서 기본 진입가를 잡는다
  const { data: candles = [] } = useStockCandles(
    open ? symbol : null,
    'day',
    1,
  )
  const marketPrice = candles.length ? Math.round(candles[0].close) : 0

  const createMutation = useCreateTrade()

  const [entryPrice, setEntryPrice] = useState<string>('')
  const [qty, setQty] = useState<string>('10')
  const [targetPrice, setTargetPrice] = useState<string>('')
  const [stopLoss, setStopLoss] = useState<string>('')
  const [emotion, setEmotion] = useState<Emotion>('중립')
  const [newsSnapshot, setNewsSnapshot] = useState<string>('')
  const [strategyNote, setStrategyNote] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // 다이얼로그 열릴 때마다 시장가 기준으로 기본값 계산
  useEffect(() => {
    if (!open || marketPrice <= 0) return
    setEntryPrice(String(marketPrice))
    setTargetPrice(String(Math.round(marketPrice * 1.06)))
    setStopLoss(String(Math.round(marketPrice * 0.97)))
    setError(null)
  }, [open, marketPrice])

  const resetAndClose = () => {
    setEntryPrice('')
    setQty('10')
    setTargetPrice('')
    setStopLoss('')
    setEmotion('중립')
    setNewsSnapshot('')
    setStrategyNote('')
    setError(null)
    onOpenChange(false)
  }

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!selected) {
      setError('종목을 먼저 선택해주세요. Cmd+K 로 종목을 검색할 수 있습니다.')
      return
    }
    const entry = parseInt(entryPrice, 10)
    const target = parseInt(targetPrice, 10)
    const stop = stopLoss ? parseInt(stopLoss, 10) : null
    const quantity = parseInt(qty, 10)

    if (Number.isNaN(entry) || entry <= 0) {
      setError('진입가는 양의 정수여야 합니다.')
      return
    }
    if (Number.isNaN(target) || target <= 0) {
      setError('목표가는 양의 정수여야 합니다.')
      return
    }
    if (Number.isNaN(quantity) || quantity <= 0) {
      setError('수량은 양의 정수여야 합니다.')
      return
    }
    if (target <= entry) {
      setError('목표가는 진입가보다 커야 합니다.')
      return
    }

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toTimeString().slice(0, 5)

    try {
      await createMutation.mutateAsync({
        symbol: selected.symbol,
        name: selected.name,
        entry_price: entry,
        target_price: target,
        stop_loss: stop,
        current_price: entry,
        qty: quantity,
        date,
        time,
        status: 'open',
        emotion,
        news_snapshot: newsSnapshot,
        strategy_note: strategyNote,
      })
      resetAndClose()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '매수 기록 생성에 실패했습니다.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border" style={{ background: 'rgb(20, 25, 45)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <Target size={16} className="text-primary" />
            매수 기록 추가
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
                {marketPrice > 0 && (
                  <>
                    {' · '}현재가{' '}
                    <span className="text-foreground">
                      {marketPrice.toLocaleString('ko-KR')}원
                    </span>
                  </>
                )}
              </>
            ) : (
              '종목이 선택되지 않았습니다'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-price" className="text-[11px] font-mono">
                진입가 (원)
              </Label>
              <Input
                id="entry-price"
                type="number"
                inputMode="numeric"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="72000"
                className="font-mono h-9"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty" className="text-[11px] font-mono">
                수량 (주)
              </Label>
              <Input
                id="qty"
                type="number"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="10"
                className="font-mono h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="target-price"
                className="text-[11px] font-mono text-bull"
              >
                목표가 (원)
              </Label>
              <Input
                id="target-price"
                type="number"
                inputMode="numeric"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="76000"
                className="font-mono h-9"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="stop-loss"
                className="text-[11px] font-mono text-bear"
              >
                손절가 (원)
              </Label>
              <Input
                id="stop-loss"
                type="number"
                inputMode="numeric"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="69500"
                className="font-mono h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono">진입 시점 감정</Label>
            <Select
              value={emotion}
              onValueChange={(v) => setEmotion(v as Emotion)}
            >
              <SelectTrigger className="h-9 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMOTIONS.map((e) => (
                  <SelectItem
                    key={e.value}
                    value={e.value}
                    className="font-mono"
                  >
                    <span className={e.tone}>{e.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="news-snapshot"
              className="text-[11px] font-mono"
            >
              뉴스 스냅샷 (선택)
            </Label>
            <Textarea
              id="news-snapshot"
              value={newsSnapshot}
              onChange={(e) => setNewsSnapshot(e.target.value)}
              placeholder="진입 당시의 주요 호재/악재 뉴스"
              rows={2}
              className="font-mono text-xs resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="strategy-note"
              className="text-[11px] font-mono"
            >
              전략 노트 (선택)
            </Label>
            <Textarea
              id="strategy-note"
              value={strategyNote}
              onChange={(e) => setStrategyNote(e.target.value)}
              placeholder="예: 20일선 눌림목 매수 전략 — RSI 28 진입, 1차 목표 73,500"
              rows={2}
              className="font-mono text-xs resize-none"
            />
          </div>

          {error && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-3 py-2">
              <p className="text-[11px] font-mono text-bear">{error}</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={resetAndClose}
              className="font-mono"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !selected}
              className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createMutation.isPending ? '기록 중...' : '매수 기록'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
