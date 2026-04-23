'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
} from 'lightweight-charts'
import {
  Diamond,
  Eye,
  EyeOff,
  Loader2,
  Newspaper,
  Settings2,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useStockStore } from '@/stores/stock-store'
import { INDICATOR_HINTS } from './indicator-hint'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useStockCandles, type Candle } from '@/hooks/use-stock-candles'
import { useStockIndicators } from '@/hooks/use-stock-indicators'
import { useStockLevels, type PriceLevel } from '@/hooks/use-stock-levels'
import { useStockNews, type NewsItem } from '@/hooks/use-stock-news'
import { useStockSignals } from '@/hooks/use-stock-signals'
import { useTradeLog, type TradeEntry } from '@/hooks/use-trade-log'
import { useWatchlistStore } from '@/stores/watchlist-store'
import { AIScanner } from './ai-scanner'

// ── Types ────────────────────────────────────────────────────────────────

const TIMEFRAMES = ['1분', '5분', '일봉', '주봉'] as const
type Timeframe = (typeof TIMEFRAMES)[number]

const TF_TO_PERIOD: Record<Timeframe, string> = {
  '1분': '1min',
  '5분': '5min',
  일봉: 'day',
  주봉: 'week',
}

const TF_DEFAULT_COUNT: Record<Timeframe, number> = {
  '1분': 120,
  '5분': 120,
  일봉: 120,
  주봉: 120,
}

const TF_MAX_COUNT: Record<Timeframe, number> = {
  '1분': 500,
  '5분': 500,
  일봉: 2000,
  주봉: 2000,
}

interface IndicatorFlags {
  ma5: boolean
  ma20: boolean
  ma60: boolean
  ma120: boolean
  bollinger: boolean
  volume: boolean
}

const MA_COLORS: Record<string, string> = {
  ma5: '#f59e0b',
  ma20: '#06b6d4',
  ma60: '#a78bfa',
  ma120: '#f87171',
}

/** OHLC 4색 팔레트 — 상단 바와 Y축 pill 에 동일 사용 */
const OHLC_COLORS = {
  open: '#fbbf24',
  high: '#f472b6',
  low: '#22d3ee',
  close: '#a78bfa',
} as const

// ── Helpers ──────────────────────────────────────────────────────────────

function formatVolumeShort(n: number): string {
  if (!n || n < 1) return '0'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toLocaleString('ko-KR')
}

function toChartTime(d: Date): Time {
  // Lightweight-charts 는 초 단위 UNIX timestamp (number) 를 Time 으로 수용
  return (Math.floor(d.getTime() / 1000) as unknown) as Time
}

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return out
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  out[period - 1] = sum / period
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period]
    out[i] = sum / period
  }
  return out
}

function bollingerBand(
  values: number[],
  period = 20,
  mult = 2,
): { upper: (number | null)[]; mid: (number | null)[]; lower: (number | null)[] } {
  const mid = sma(values, period)
  const upper: (number | null)[] = new Array(values.length).fill(null)
  const lower: (number | null)[] = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i]
    if (m == null) continue
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) {
      variance += (values[j] - m) ** 2
    }
    const std = Math.sqrt(variance / period)
    upper[i] = m + mult * std
    lower[i] = m - mult * std
  }
  return { upper, mid, lower }
}

function rsiSeries(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgG = gains / period
  let avgL = losses / period
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    avgG = (avgG * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgL = (avgL * (period - 1) + (diff < 0 ? -diff : 0)) / period
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)
  }
  return out
}

// ── Chart config (공통) ─────────────────────────────────────────────────

const CHART_LAYOUT = {
  background: { type: ColorType.Solid, color: '#0b0e14' },
  textColor: '#94a3b8',
}
const GRID_LINE_COLOR = 'rgba(148,163,184,0.10)'

// ── Sub components ──────────────────────────────────────────────────────

interface HoveredOHLC {
  open: number
  high: number
  low: number
  close: number
  volume: number
  time: Date | null
  /** 차트 컨테이너 기준 마우스 좌표 (tooltip 위치) */
  x?: number
  y?: number
}

function ChartHoverTooltip({
  hovered,
  prevClose,
}: {
  hovered: HoveredOHLC
  prevClose: number | undefined
}) {
  const x = hovered.x ?? 0
  const y = hovered.y ?? 0
  // 커서 우측 하단에 기본 배치 — 화면 경계 근처에서 자동 반대편으로
  // (단순 clamp: x가 절반 넘으면 왼쪽, y가 절반 넘으면 위쪽)
  const offset = 14
  const tooltipW = 180
  const tooltipH = 120
  // parent container 크기를 추정 (responsive fallback)
  const placeLeft = x > 400
  const placeTop = y > 250

  const chg = prevClose ? hovered.close - prevClose : 0
  const chgPct = prevClose ? (chg / prevClose) * 100 : 0
  const isUp = chg >= 0

  const timeLabel = hovered.time
    ? hovered.time.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div
      className="absolute z-40 pointer-events-none glass-card border border-border rounded-lg shadow-lg p-2.5 font-mono min-w-[170px]"
      style={{
        left: placeLeft ? x - tooltipW - offset : x + offset,
        top: placeTop ? y - tooltipH - offset : y + offset,
      }}
    >
      <div className="text-[10px] text-muted-foreground mb-1.5 tabular-nums">
        {timeLabel}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        <span style={{ color: OHLC_COLORS.open }}>시가</span>
        <span
          className="text-right tabular-nums"
          style={{ color: OHLC_COLORS.open }}
        >
          {Math.round(hovered.open).toLocaleString('ko-KR')}
        </span>
        <span style={{ color: OHLC_COLORS.high }}>고가</span>
        <span
          className="text-right tabular-nums"
          style={{ color: OHLC_COLORS.high }}
        >
          {Math.round(hovered.high).toLocaleString('ko-KR')}
        </span>
        <span style={{ color: OHLC_COLORS.low }}>저가</span>
        <span
          className="text-right tabular-nums"
          style={{ color: OHLC_COLORS.low }}
        >
          {Math.round(hovered.low).toLocaleString('ko-KR')}
        </span>
        <span style={{ color: OHLC_COLORS.close }}>종가</span>
        <span
          className="text-right tabular-nums font-bold"
          style={{ color: OHLC_COLORS.close }}
        >
          {Math.round(hovered.close).toLocaleString('ko-KR')}
        </span>
        {prevClose != null && (
          <>
            <span className="text-muted-foreground">변동</span>
            <span
              className={`text-right tabular-nums ${
                isUp ? 'text-bull' : 'text-bear'
              }`}
            >
              {isUp ? '+' : ''}
              {Math.round(chg).toLocaleString('ko-KR')} ({isUp ? '+' : ''}
              {chgPct.toFixed(2)}%)
            </span>
          </>
        )}
        <span className="text-muted-foreground">볼륨</span>
        <span className="text-right tabular-nums text-foreground">
          {formatVolumeShort(hovered.volume)}
        </span>
      </div>
    </div>
  )
}


function IndicatorBtn({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active: boolean
  color: string
  onClick: () => void
}) {
  const hint = INDICATOR_HINTS[label]
  const button = (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-all border ${
        active ? 'border-current opacity-100' : 'border-border opacity-40 hover:opacity-70'
      }`}
      style={{ color: active ? color : undefined }}
      aria-label={active ? `${label} 끄기` : `${label} 켜기`}
    >
      {active ? <Eye size={10} /> : <EyeOff size={10} />}
      {label}
    </button>
  )

  if (!hint) return button

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs"
          style={{
            background: 'rgb(20, 25, 45)',
            color: 'rgb(230, 234, 245)',
            border: '1px solid rgb(42, 46, 55)',
          }}
        >
          <p className="text-xs font-sans leading-relaxed">
            <span className="font-bold" style={{ color }}>
              {label}
            </span>{' '}
            · {hint}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            클릭: {active ? '끄기' : '켜기'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ── Main component ──────────────────────────────────────────────────────

export function AIChart() {
  const selected = useStockStore((s) => s.selected)
  const symbol = selected?.symbol ?? null

  const [selectedTF, setSelectedTF] = useState<Timeframe>('일봉')
  const [loadedCount, setLoadedCount] = useState<number>(
    TF_DEFAULT_COUNT['일봉'],
  )
  const [indicatorFlags, setIndicatorFlags] = useState<IndicatorFlags>({
    ma5: true,
    ma20: true,
    ma60: true,
    ma120: false,
    bollinger: true,
    volume: true,
  })
  const [showToolbar, setShowToolbar] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [hovered, setHovered] = useState<HoveredOHLC | null>(null)
  const [hoveredLevel, setHoveredLevel] = useState<PriceLevel | null>(null)
  const prevSymbolRef = useRef<string | null>(null)

  // 관심종목 토글
  const isFavorite = useWatchlistStore((s) => s.isFavorite)
  const toggleFavorite = useWatchlistStore((s) => s.toggleFavorite)
  const favorited = selected ? isFavorite(selected.symbol) : false

  const { data: candles = [], isLoading, isFetching } = useStockCandles(
    symbol,
    TF_TO_PERIOD[selectedTF],
    loadedCount,
  )
  const { data: indicators } = useStockIndicators(symbol)
  const { data: news = [] } = useStockNews(symbol, 10)
  const { data: signal } = useStockSignals(symbol)
  const { data: allTrades = [] } = useTradeLog()
  const { data: levelsData } = useStockLevels(symbol)

  const heldTrades = useMemo<TradeEntry[]>(
    () =>
      symbol
        ? allTrades.filter((t) => t.symbol === symbol && t.status === 'open')
        : [],
    [allTrades, symbol],
  )
  const aiLevels: PriceLevel[] = levelsData?.levels ?? []

  // 종목 진입·전환 시 스캐너 + loadedCount 초기화
  useEffect(() => {
    if (!symbol) return
    if (!prevSymbolRef.current || prevSymbolRef.current !== symbol) {
      setScanning(true)
    }
    prevSymbolRef.current = symbol
  }, [symbol])

  // 타임프레임 전환 시 loadedCount 초기화
  useEffect(() => {
    setLoadedCount(TF_DEFAULT_COUNT[selectedTF])
  }, [selectedTF])

  // ── Chart refs ─────────────────────────────────────────────────────
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const mainChartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ma60Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ma120Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMidRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbAreaRef = useRef<ISeriesApi<'Area'> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  // ── Chart 생성 (한 번만) ────────────────────────────────────────────
  useEffect(() => {
    const container = mainContainerRef.current
    if (!container) return

    // 초기 크기 — flex-1 컨테이너가 아직 0 일 수 있으므로 최소값 지정
    const initW = container.clientWidth || 600
    const initH = container.clientHeight || 400

    const chart = createChart(container, {
      width: initW,
      height: initH,
      layout: CHART_LAYOUT,
      grid: {
        vertLines: { color: GRID_LINE_COLOR },
        horzLines: { color: GRID_LINE_COLOR },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255,255,255,0.3)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#f59e0b',
        },
        horzLine: {
          color: 'rgba(255,255,255,0.3)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#f59e0b',
        },
      },
      timeScale: {
        borderColor: '#2a2e37',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
      },
      rightPriceScale: {
        borderColor: '#2a2e37',
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
    })

    // ResizeObserver 로 컨테이너 크기 변화 추적
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          chart.resize(width, height)
        }
      }
    })
    resizeObserver.observe(container)

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444', // 한국식: 상승=빨강
      downColor: '#3b82f6', // 한국식: 하락=파랑
      wickUpColor: '#ef4444',
      wickDownColor: '#3b82f6',
      borderVisible: false,
    })

    // 볼륨 시리즈 — 별도 scale, 차트 하단 20% 차지
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart
      .priceScale('volume')
      .applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    // MA lines
    const ma5 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma5,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const ma20 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const ma60 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma60,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const ma120 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma120,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Bollinger (area + upper/lower line)
    const bbArea = chart.addSeries(AreaSeries, {
      lineColor: 'transparent',
      topColor: 'rgba(167,139,250,0.08)',
      bottomColor: 'rgba(167,139,250,0.02)',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const bbUpper = chart.addSeries(LineSeries, {
      color: '#a78bfa',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const bbMid = chart.addSeries(LineSeries, {
      color: 'rgba(167,139,250,0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const bbLower = chart.addSeries(LineSeries, {
      color: '#a78bfa',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // F6: rAF 쓰로틀 — 60fps 마우스 이벤트를 프레임당 1회 setState 로 제한
    let rafPending = false
    let pendingHover: HoveredOHLC | null = null
    const flushHover = () => {
      rafPending = false
      setHovered(pendingHover)
    }

    // Crosshair move → 상단 OHLC 바 + floating tooltip 위치 갱신
    chart.subscribeCrosshairMove((param) => {
      let next: HoveredOHLC | null = null
      if (param.time && param.point && param.seriesData.size) {
        const cd = param.seriesData.get(candleSeries) as
          | CandlestickData
          | undefined
        const vd = param.seriesData.get(volumeSeries) as
          | HistogramData
          | undefined
        if (cd) {
          next = {
            open: cd.open,
            high: cd.high,
            low: cd.low,
            close: cd.close,
            volume: vd?.value ?? 0,
            time:
              typeof param.time === 'number'
                ? new Date((param.time as number) * 1000)
                : null,
            x: param.point.x,
            y: param.point.y,
          }
        }
      }
      pendingHover = next
      if (!rafPending) {
        rafPending = true
        requestAnimationFrame(flushHover)
      }
    })

    mainChartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    ma5Ref.current = ma5
    ma20Ref.current = ma20
    ma60Ref.current = ma60
    ma120Ref.current = ma120
    bbAreaRef.current = bbArea
    bbUpperRef.current = bbUpper
    bbMidRef.current = bbMid
    bbLowerRef.current = bbLower

    return () => {
      resizeObserver.disconnect()
      priceLinesRef.current = []
      markersRef.current = null
      chart.remove()
      mainChartRef.current = null
      candleSeriesRef.current = null
    }
  }, [])

  // ── RSI 서브차트 (한 번만) ─────────────────────────────────────────
  useEffect(() => {
    const container = rsiContainerRef.current
    if (!container) return
    const initW = container.clientWidth || 600
    const initH = container.clientHeight || 52

    const chart = createChart(container, {
      width: initW,
      height: initH,
      layout: CHART_LAYOUT,
      grid: {
        vertLines: { color: GRID_LINE_COLOR },
        horzLines: { color: GRID_LINE_COLOR },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: '#2a2e37',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
      },
      rightPriceScale: {
        borderColor: '#2a2e37',
        visible: true,
      },
    })

    const rsiResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) chart.resize(width, height)
      }
    })
    rsiResizeObserver.observe(container)
    const series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    series.createPriceLine({
      price: 30,
      color: 'rgba(245,158,11,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    })
    series.createPriceLine({
      price: 70,
      color: 'rgba(248,113,113,0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    })
    rsiChartRef.current = chart
    rsiSeriesRef.current = series
    return () => {
      rsiResizeObserver.disconnect()
      chart.remove()
      rsiChartRef.current = null
      rsiSeriesRef.current = null
    }
  }, [])

  // ── 메인 <-> RSI 시간축 sync ───────────────────────────────────────
  useEffect(() => {
    const main = mainChartRef.current
    const rsi = rsiChartRef.current
    if (!main || !rsi) return
    const unsubMain = main
      .timeScale()
      .subscribeVisibleLogicalRangeChange((range) => {
        if (range) rsi.timeScale().setVisibleLogicalRange(range)
      })
    const unsubRsi = rsi
      .timeScale()
      .subscribeVisibleLogicalRangeChange((range) => {
        if (range) main.timeScale().setVisibleLogicalRange(range)
      })
    return () => {
      main.timeScale().unsubscribeVisibleLogicalRangeChange(unsubMain as any)
      rsi.timeScale().unsubscribeVisibleLogicalRangeChange(unsubRsi as any)
    }
  }, [])

  // ── Pan 좌측 끝 감지 → loadedCount 확장 ─────────────────────────────
  useEffect(() => {
    const chart = mainChartRef.current
    if (!chart) return
    const handler = (range: unknown) => {
      if (!range) return
      const r = range as { from: number; to: number }
      if (
        r.from < 5 &&
        loadedCount < TF_MAX_COUNT[selectedTF] &&
        !isFetching
      ) {
        setLoadedCount((c) =>
          Math.min(c + TF_DEFAULT_COUNT[selectedTF], TF_MAX_COUNT[selectedTF]),
        )
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler as any)
    return () => {
      chart
        .timeScale()
        .unsubscribeVisibleLogicalRangeChange(handler as any)
    }
  }, [loadedCount, selectedTF, isFetching])

  // ── 캔들 데이터 적용 ───────────────────────────────────────────────
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!candleSeries || !volumeSeries || candles.length === 0) return

    const candleData: CandlestickData[] = candles.map((c: Candle) => ({
      time: toChartTime(new Date(c.time)),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    candleSeries.setData(candleData)

    const volumeData: HistogramData[] = candles.map((c: Candle) => ({
      time: toChartTime(new Date(c.time)),
      value: c.volume,
      color:
        c.close >= c.open ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.5)',
    }))
    volumeSeries.setData(volumeData)

    // MA / Bollinger / RSI 계산
    const closes = candles.map((c) => c.close)
    const sma5 = sma(closes, 5)
    const sma20 = sma(closes, 20)
    const sma60 = sma(closes, 60)
    const sma120 = sma(closes, 120)
    const bb = bollingerBand(closes, 20, 2)
    const rsi = rsiSeries(closes, 14)

    const mkLine = (arr: (number | null)[]): LineData[] =>
      candles
        .map((c, i) => ({
          time: toChartTime(new Date(c.time)),
          value: arr[i] ?? NaN,
        }))
        .filter((d) => !Number.isNaN(d.value)) as LineData[]

    ma5Ref.current?.setData(mkLine(sma5))
    ma20Ref.current?.setData(mkLine(sma20))
    ma60Ref.current?.setData(mkLine(sma60))
    ma120Ref.current?.setData(mkLine(sma120))
    bbUpperRef.current?.setData(mkLine(bb.upper))
    bbMidRef.current?.setData(mkLine(bb.mid))
    bbLowerRef.current?.setData(mkLine(bb.lower))
    bbAreaRef.current?.setData(mkLine(bb.upper))
    rsiSeriesRef.current?.setData(mkLine(rsi))
  }, [candles])

  // ── 지표 토글 → 시리즈 visible ──────────────────────────────────────
  useEffect(() => {
    ma5Ref.current?.applyOptions({ visible: indicatorFlags.ma5 })
    ma20Ref.current?.applyOptions({ visible: indicatorFlags.ma20 })
    ma60Ref.current?.applyOptions({ visible: indicatorFlags.ma60 })
    ma120Ref.current?.applyOptions({ visible: indicatorFlags.ma120 })
    bbUpperRef.current?.applyOptions({ visible: indicatorFlags.bollinger })
    bbMidRef.current?.applyOptions({ visible: indicatorFlags.bollinger })
    bbLowerRef.current?.applyOptions({ visible: indicatorFlags.bollinger })
    bbAreaRef.current?.applyOptions({ visible: indicatorFlags.bollinger })
    volumeSeriesRef.current?.applyOptions({ visible: indicatorFlags.volume })
  }, [indicatorFlags])

  // ── Price lines (OHLC + 지지/저항 + 매수/목표/손절) ─────────────────
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series || candles.length === 0) return

    // 기존 라인 정리
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line)
      } catch {
        /* ignore */
      }
    }
    priceLinesRef.current = []

    const lastRow = candles[candles.length - 1]
    const ohlcUniq = new Set<number>()
    const addLine = (
      price: number,
      color: string,
      title: string,
      style: LineStyle = LineStyle.Dashed,
    ) => {
      if (ohlcUniq.has(price)) return
      ohlcUniq.add(price)
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title,
      })
      priceLinesRef.current.push(line)
    }

    // OHLC 4색 pill
    addLine(lastRow.open, OHLC_COLORS.open, '시', LineStyle.Dotted)
    addLine(lastRow.high, OHLC_COLORS.high, '고', LineStyle.Dotted)
    addLine(lastRow.low, OHLC_COLORS.low, '저', LineStyle.Dotted)
    addLine(lastRow.close, OHLC_COLORS.close, '종', LineStyle.Solid)

    // AI 지지/저항
    for (const lv of aiLevels) {
      addLine(
        lv.price,
        lv.kind === 'support' ? '#e11d48' : '#0284c7',
        lv.kind === 'support' ? `지지 ${lv.strength}` : `저항 ${lv.strength}`,
      )
    }

    // 매수/목표/손절
    for (const trade of heldTrades) {
      addLine(trade.entry_price, '#f59e0b', '매수')
      addLine(trade.target_price, '#f43f5e', '목표')
      if (trade.stop_loss != null) {
        addLine(trade.stop_loss, '#0ea5e9', '손절')
      }
    }
  }, [candles, aiLevels, heldTrades])

  // ── BUY 시그널 마커 ─────────────────────────────────────────────────
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series || candles.length === 0) return

    // RSI < 32 지점에 BUY 마커
    const closes = candles.map((c) => c.close)
    const rsi = rsiSeries(closes, 14)
    const markers = candles
      .map((c, i) => ({ c, i, rsiVal: rsi[i] }))
      .filter((x) => x.rsiVal != null && x.rsiVal < 32)
      .map((x) => ({
        time: toChartTime(new Date(x.c.time)),
        position: 'belowBar' as const,
        color: '#f59e0b',
        shape: 'arrowUp' as const,
        text: 'BUY',
      }))

    // 기존 마커 플러그인 제거 후 새로 생성
    if (markersRef.current) {
      try {
        markersRef.current.setMarkers([])
      } catch {
        /* ignore */
      }
    }
    markersRef.current = createSeriesMarkers(series, markers)
  }, [candles])

  // ── Render ─────────────────────────────────────────────────────────
  //
  // ⚠ early return 을 사용하지 않는다: chart 컨테이너 <div ref={mainContainerRef}>
  // 가 DOM 에 항상 존재해야 createChart 를 호출하는 useEffect([]) 에서
  // ref.current 가 null 이 아니게 된다. empty/loading 상태는 overlay 로 표시.

  const hasData = candles.length > 0
  const lastRow = candles[candles.length - 1]
  const prevRow = candles[candles.length - 2] ?? lastRow
  const lastClose = lastRow?.close ?? 0
  const changeAmt = lastRow && prevRow ? lastClose - prevRow.close : 0
  const changePct = prevRow?.close ? (changeAmt / prevRow.close) * 100 : 0
  const isUp = changeAmt >= 0
  // OHLC 바는 hover 데이터 우선, 없으면 최신 캔들
  const barData = hovered ?? {
    open: lastRow?.open ?? 0,
    high: lastRow?.high ?? 0,
    low: lastRow?.low ?? 0,
    close: lastRow?.close ?? 0,
    volume: lastRow?.volume ?? 0,
    time: lastRow ? new Date(lastRow.time) : null,
  }

  const toggleIndicator = (key: keyof IndicatorFlags) => {
    setIndicatorFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex flex-col h-full glass-card rounded-xl overflow-hidden">
      {/* 상단 헤더 — selected 있을 때만 */}
      {selected && (
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-foreground font-bold text-lg font-display">
                {selected.name}
              </span>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {selected.symbol}
              </span>
              <button
                onClick={() => toggleFavorite(selected)}
                className={`transition-colors ${
                  favorited
                    ? 'text-primary hover:text-primary/80'
                    : 'text-muted-foreground/50 hover:text-primary'
                }`}
                aria-label={
                  favorited ? '관심종목에서 제거' : '관심종목에 추가'
                }
                title={
                  favorited ? '관심종목에서 제거' : '관심종목에 추가'
                }
              >
                <Star
                  size={14}
                  fill={favorited ? 'currentColor' : 'none'}
                  strokeWidth={favorited ? 0 : 2}
                />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] font-mono border border-secondary/30 bg-secondary/10 text-secondary rounded px-1.5 py-0.5">
                {selected.market}
              </span>
              {selected.sector && (
                <span className="text-[9px] font-mono text-muted-foreground">
                  {selected.sector}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span
            className={`text-2xl font-mono font-bold tracking-tight ${
              isUp ? 'text-bull' : 'text-bear'
            }`}
          >
            {Math.round(lastClose).toLocaleString('ko-KR')}
          </span>
          <div
            className={`flex items-center gap-1 text-sm font-mono ${
              isUp ? 'text-bull' : 'text-bear'
            }`}
          >
            {isUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            <span>
              {isUp ? '+' : ''}
              {Math.round(changeAmt).toLocaleString('ko-KR')}
            </span>
            <span>
              ({isUp ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {signal?.type === 'STRONG_BUY' && (
            <div className="flex items-center gap-1.5 bg-primary/25 border border-primary rounded-lg px-3 py-1.5 glow-amber animate-pulse">
              <Diamond size={11} fill="#f59e0b" className="text-primary" />
              <span className="text-primary text-xs font-mono font-bold text-glow-amber">
                AI STRONG BUY
              </span>
            </div>
          )}
          {signal?.type === 'BUY' && (
            <div className="flex items-center gap-1.5 bg-bull/10 border border-bull/40 rounded-lg px-3 py-1.5">
              <Diamond size={11} fill="#22c55e" className="text-bull" />
              <span className="text-bull text-xs font-mono font-semibold">
                AI BUY 시그널
              </span>
            </div>
          )}
          {signal?.type === 'SELL' && (
            <div className="flex items-center gap-1.5 bg-bear/10 border border-bear/40 rounded-lg px-3 py-1.5">
              <Diamond size={11} fill="#ef4444" className="text-bear" />
              <span className="text-bear text-xs font-mono font-semibold">
                AI SELL 시그널
              </span>
            </div>
          )}
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTF(tf)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  tf === selectedTF
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* OHLC 요약 바 — hover 캔들 기반 (selected + 데이터 있을 때만) */}
      {selected && hasData && (
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 px-4 py-1.5 border-b border-border shrink-0 bg-muted/10">
        <div className="flex items-baseline gap-1">
          <span
            className="text-[10px] font-mono"
            style={{ color: OHLC_COLORS.open }}
          >
            시
          </span>
          <span
            className="text-xs font-mono font-semibold tabular-nums"
            style={{ color: OHLC_COLORS.open }}
          >
            {Math.round(barData.open).toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[10px] font-mono"
            style={{ color: OHLC_COLORS.high }}
          >
            고
          </span>
          <span
            className="text-xs font-mono font-semibold tabular-nums"
            style={{ color: OHLC_COLORS.high }}
          >
            {Math.round(barData.high).toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[10px] font-mono"
            style={{ color: OHLC_COLORS.low }}
          >
            저
          </span>
          <span
            className="text-xs font-mono font-semibold tabular-nums"
            style={{ color: OHLC_COLORS.low }}
          >
            {Math.round(barData.low).toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[10px] font-mono"
            style={{ color: OHLC_COLORS.close }}
          >
            종
          </span>
          <span
            className="text-xs font-mono font-semibold tabular-nums"
            style={{ color: OHLC_COLORS.close }}
          >
            {Math.round(barData.close).toLocaleString('ko-KR')}
          </span>
        </div>
        {!hovered && (
          <div
            className={`flex items-baseline gap-1 text-xs font-mono font-semibold tabular-nums ${
              isUp ? 'text-bull' : 'text-bear'
            }`}
          >
            <span>
              {isUp ? '+' : ''}
              {Math.round(changeAmt).toLocaleString('ko-KR')}
            </span>
            <span>
              ({isUp ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1 ml-auto">
          <span className="text-[10px] font-mono text-muted-foreground">
            볼륨
          </span>
          <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
            {formatVolumeShort(barData.volume)}
          </span>
        </div>
      </div>
      )}

      {/* 메인 차트 영역 — 컨테이너는 항상 마운트 (createChart ref 필수) */}
      <div className="flex-1 min-h-[300px] relative">
        {/* Empty state — 종목 미선택 */}
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm font-mono z-30">
            종목을 선택해주세요 (Cmd+K)
          </div>
        )}

        {/* Loading overlay — 첫 로딩 */}
        {selected && isLoading && !hasData && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground text-sm font-mono z-30 bg-background/40">
            <Loader2 size={14} className="animate-spin" />
            차트 데이터 로딩 중...
          </div>
        )}

        {/* 로딩 바 (백그라운드 fetch 인디케이터) */}
        {isFetching && hasData && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/10 overflow-hidden z-30 pointer-events-none">
            <div className="h-full bg-primary/70 animate-pulse w-1/3" />
          </div>
        )}

        {/* Pan 상한 도달 안내 */}
        {loadedCount >= TF_MAX_COUNT[selectedTF] && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 text-[10px] font-mono text-muted-foreground/70 bg-background/80 px-2 py-0.5 rounded">
            과거 데이터 상한 ({TF_MAX_COUNT[selectedTF]}봉)
          </div>
        )}

        {/* 지표 툴바 */}
        <button
          onClick={() => setShowToolbar((v) => !v)}
          className={`absolute top-2 left-2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
            showToolbar
              ? 'bg-primary/20 border-primary/40 text-primary glow-amber'
              : 'glass-card border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
          }`}
          title="지표 툴바 토글"
        >
          <Settings2 size={12} />
          지표
        </button>

        {showToolbar && (
          <div
            className="absolute top-10 left-2 z-30 glass-card border border-border rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap"
          >
            <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mr-0.5 shrink-0">
              지표
            </span>
            <IndicatorBtn
              label="MA5"
              active={indicatorFlags.ma5}
              color={MA_COLORS.ma5}
              onClick={() => toggleIndicator('ma5')}
            />
            <IndicatorBtn
              label="MA20"
              active={indicatorFlags.ma20}
              color={MA_COLORS.ma20}
              onClick={() => toggleIndicator('ma20')}
            />
            <IndicatorBtn
              label="MA60"
              active={indicatorFlags.ma60}
              color={MA_COLORS.ma60}
              onClick={() => toggleIndicator('ma60')}
            />
            <IndicatorBtn
              label="MA120"
              active={indicatorFlags.ma120}
              color={MA_COLORS.ma120}
              onClick={() => toggleIndicator('ma120')}
            />
            <IndicatorBtn
              label="볼린저"
              active={indicatorFlags.bollinger}
              color="#a78bfa"
              onClick={() => toggleIndicator('bollinger')}
            />
            <IndicatorBtn
              label="거래량"
              active={indicatorFlags.volume}
              color="#06b6d4"
              onClick={() => toggleIndicator('volume')}
            />
          </div>
        )}

        {/* 지지/저항 칩 */}
        {aiLevels.length > 0 && (
          <div className="absolute top-2 right-2 z-30 flex flex-col items-end gap-1">
            <div className="glass-card border border-border/50 rounded-lg px-2 py-1 flex flex-col gap-1">
              <span className="text-[8px] font-mono text-muted-foreground/70 uppercase tracking-wider">
                AI 지지/저항
              </span>
              {aiLevels.map((lv) => {
                const isSupport = lv.kind === 'support'
                const color = isSupport ? '#e11d48' : '#0284c7'
                return (
                  <button
                    key={`chip-${lv.kind}-${lv.price}`}
                    onMouseEnter={() => setHoveredLevel(lv)}
                    onMouseLeave={() => setHoveredLevel(null)}
                    className="flex items-center gap-1.5 text-[10px] font-mono rounded border px-1.5 py-0.5 transition-all hover:scale-105"
                    style={{
                      color,
                      borderColor: `${color}55`,
                      background: `${color}0d`,
                    }}
                  >
                    <span className="font-bold">
                      {isSupport ? '지지' : '저항'}
                    </span>
                    <span className="tabular-nums">
                      {Math.round(lv.price).toLocaleString('ko-KR')}
                    </span>
                    <span className="text-[9px] opacity-70 tabular-nums">
                      · {lv.strength}
                    </span>
                  </button>
                )
              })}
            </div>
            {hoveredLevel && (
              <div
                className="glass-card rounded-lg border p-2.5 max-w-[280px] pointer-events-none"
                style={{
                  borderColor:
                    hoveredLevel.kind === 'support'
                      ? 'rgba(225,29,72,0.4)'
                      : 'rgba(2,132,199,0.4)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-[9px] font-mono font-bold uppercase tracking-wider"
                    style={{
                      color:
                        hoveredLevel.kind === 'support'
                          ? '#e11d48'
                          : '#0284c7',
                    }}
                  >
                    {hoveredLevel.kind === 'support' ? '지지선' : '저항선'}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground tabular-nums ml-auto">
                    터치 {hoveredLevel.touch_count}회 · strength{' '}
                    {hoveredLevel.strength}
                  </span>
                </div>
                <div className="text-[11px] font-mono font-bold text-foreground mb-1 tabular-nums">
                  {Math.round(hoveredLevel.price).toLocaleString('ko-KR')}원
                </div>
                <p className="text-[10px] font-mono text-foreground/80 leading-snug">
                  {hoveredLevel.explanation ||
                    '알고리즘이 감지한 후보 레벨.'}
                </p>
              </div>
            )}
          </div>
        )}

        {scanning && selected && (
          <AIScanner
            stockName={`${selected.name} (${selected.symbol})`}
            onComplete={() => setScanning(false)}
          />
        )}

        {/* 호버 Tooltip — 캔들에 마우스 올리면 OHLC + 거래량 + 변동 표시 */}
        {hovered && hovered.x != null && hovered.y != null && (
          <ChartHoverTooltip hovered={hovered} prevClose={prevRow?.close} />
        )}

        {/* lightweight-charts 캔버스 컨테이너 */}
        <div ref={mainContainerRef} className="w-full h-full" />
      </div>

      {/* RSI 서브차트 */}
      <div className="h-24 px-3 pb-2 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-1 py-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            RSI (14)
          </span>
          {indicators?.rsi14 != null && (
            <span
              className={`text-[10px] font-mono font-bold ${
                indicators.rsi14 < 30
                  ? 'text-primary text-glow-amber'
                  : indicators.rsi14 > 70
                    ? 'text-bear'
                    : 'text-bull'
              }`}
            >
              {indicators.rsi14.toFixed(1)}
              {indicators.rsi14 < 30 && ' — 과매도 Buy Zone'}
              {indicators.rsi14 > 70 && ' — 과매수 주의'}
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            30 / 70 기준선
          </span>
        </div>
        <div ref={rsiContainerRef} className="w-full h-[52px]" />
      </div>

      {/* 뉴스 타임라인 (X축 아래) */}
      {news.length > 0 && candles.length > 0 && (
        <NewsTimeline news={news} candles={candles} />
      )}
    </div>
  )
}


// ── News Timeline (별도 컴포넌트) ────────────────────────────────────

function NewsTimeline({
  news,
  candles,
}: {
  news: NewsItem[]
  candles: Candle[]
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const events = useMemo(() => {
    if (!candles.length) return [] as { index: number; news: NewsItem }[]
    const seen = new Set<number>()
    const result: { index: number; news: NewsItem }[] = []
    for (const item of news) {
      if (!item.published_at) continue
      const itemTime = new Date(item.published_at).getTime()
      let bestIdx = -1
      let bestDiff = Number.POSITIVE_INFINITY
      candles.forEach((c, i) => {
        const diff = Math.abs(new Date(c.time).getTime() - itemTime)
        if (diff < bestDiff) {
          bestDiff = diff
          bestIdx = i
        }
      })
      if (bestIdx < 0 || seen.has(bestIdx)) continue
      seen.add(bestIdx)
      result.push({ index: bestIdx, news: item })
      if (result.length >= 6) break
    }
    return result
  }, [news, candles])

  const hovered = hoveredIdx != null
    ? events.find((e) => e.index === hoveredIdx) ?? null
    : null

  if (events.length === 0) return null

  return (
    <div className="px-3 pb-2 relative shrink-0">
      {hovered && (
        <div
          className="absolute bottom-full mb-2 z-50 glass-card rounded-lg border p-3 max-w-[240px] pointer-events-none"
          style={{
            left: `clamp(0px, calc(${(hovered.index / Math.max(1, candles.length - 1)) * 100}% - 120px), calc(100% - 240px))`,
            borderColor:
              hovered.news.sentiment === 'pos'
                ? 'rgba(239,68,68,0.4)'
                : hovered.news.sentiment === 'neg'
                  ? 'rgba(59,130,246,0.4)'
                  : 'rgba(148,163,184,0.4)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="text-[9px] font-mono font-bold uppercase"
              style={{
                color:
                  hovered.news.sentiment === 'pos'
                    ? '#ef4444'
                    : hovered.news.sentiment === 'neg'
                      ? '#3b82f6'
                      : '#94a3b8',
              }}
            >
              {hovered.news.sentiment === 'pos'
                ? '호재'
                : hovered.news.sentiment === 'neg'
                  ? '악재'
                  : '중립'}
            </span>
          </div>
          <p className="text-[10px] text-foreground leading-relaxed font-mono">
            {hovered.news.headline}
          </p>
          {hovered.news.source && (
            <p className="text-[9px] text-muted-foreground mt-1 font-mono">
              {hovered.news.source}
            </p>
          )}
        </div>
      )}
      <div className="relative h-5 mx-1 border-t border-border/30">
        <span className="absolute left-0 top-0.5 text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider select-none">
          뉴스
        </span>
        {events.map((ev, idx) => {
          const pct = (ev.index / Math.max(1, candles.length - 1)) * 100
          const isPos = ev.news.sentiment === 'pos'
          const isNeg = ev.news.sentiment === 'neg'
          const color = isPos ? '#fda4af' : isNeg ? '#7dd3fc' : '#f1f5f9'
          const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Newspaper
          return (
            <div
              key={`${idx}-${ev.index}-${ev.news.id}`}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
            >
              <button
                className="flex items-center justify-center w-4 h-4 rounded-full border transition-all hover:scale-110"
                style={{
                  background: `${color}44`,
                  borderColor: color,
                  boxShadow: `0 0 4px ${color}99`,
                }}
                onMouseEnter={() => setHoveredIdx(ev.index)}
                onMouseLeave={() => setHoveredIdx(null)}
                aria-label={ev.news.headline}
              >
                <Icon size={9} style={{ color }} strokeWidth={3} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
