'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useMarketBriefing } from '@/hooks/use-market-briefing'

const WEATHER_ICON: Record<string, string> = {
  '맑음': '\u2600\uFE0F',    // ☀️
  '흐림': '\u26C5',          // ⛅
  '비': '\u26C8\uFE0F',      // ⛈️
}

const WEATHER_COLOR: Record<string, string> = {
  '맑음': 'border-bull/30 bg-bull/5',
  '흐림': 'border-secondary/30 bg-secondary/5',
  '비': 'border-bear/30 bg-bear/5',
}

/**
 * AI 시장 브리핑 카드 — 발견 패널 상단에 컴팩트하게 배치.
 *
 * - 기본: ☀️ 날씨 아이콘 + 1줄 헤드라인
 * - 확장: 본문 3~4문장 + 강세/약세 섹터 chip
 */
export function MarketBriefingCard() {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading } = useMarketBriefing()

  if (isLoading) {
    return (
      <div className="mx-3 mt-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles size={11} className="text-primary animate-pulse" />
          <span className="text-[11px] font-mono text-muted-foreground">
            AI 브리핑 생성 중...
          </span>
        </div>
      </div>
    )
  }

  if (!data) return null

  const colorCls = WEATHER_COLOR[data.weather] ?? WEATHER_COLOR['흐림']
  const icon = WEATHER_ICON[data.weather] ?? '⛅'

  return (
    <div className={`mx-3 mt-2 rounded-lg border ${colorCls} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-muted/10 transition-colors"
      >
        <span className="text-base leading-none shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles size={9} className="text-primary shrink-0" />
            <span className="text-[9px] font-mono text-primary uppercase tracking-wider font-bold">
              오늘의 시장 · Nion AI
            </span>
          </div>
          <p
            className={`text-[11px] font-sans text-foreground leading-snug ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            {data.headline}
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={12} className="text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronDown size={12} className="text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
          <p className="text-[11px] font-sans text-foreground/90 leading-relaxed">
            {data.briefing}
          </p>

          {data.sectors_strong.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-bull uppercase tracking-wider mb-1">
                강세 섹터
              </div>
              <div className="flex flex-wrap gap-1">
                {data.sectors_strong.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-mono rounded border border-bull/30 bg-bull/10 text-bull px-1.5 py-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.sectors_weak.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-bear uppercase tracking-wider mb-1">
                약세 섹터
              </div>
              <div className="flex flex-wrap gap-1">
                {data.sectors_weak.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-mono rounded border border-bear/30 bg-bear/10 text-bear px-1.5 py-0.5"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="text-[8px] font-mono text-muted-foreground/60 text-right">
            {data.date}
          </div>
        </div>
      )}
    </div>
  )
}
