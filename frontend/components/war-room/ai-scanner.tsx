'use client'

import { useEffect, useState } from 'react'
import { Diamond, Zap, CheckCircle2, Loader2 } from 'lucide-react'

interface AIScannerProps {
  stockName: string
  onComplete: () => void
}

const STEPS = [
  { id: 1, label: 'RSI 과매도 구간 탐색 중...', done: 'RSI (14) = 28.4 — 과매도 확인' },
  { id: 2, label: '이동평균선 배열 분석 중...', done: 'MA5 > MA20 > MA60 정배열 감지' },
  { id: 3, label: '뉴스 센티먼트 스캔 중...', done: '긍정 비중 73% — 임계값 70% 초과' },
  { id: 4, label: 'AI 타점 로직 종합 중...', done: '3/3 조건 충족 — Buy Signal 생성' },
]

export function AIScanner({ stockName, onComplete }: AIScannerProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [doneSteps, setDoneSteps] = useState<number[]>([])
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    setCurrentStep(0)
    setDoneSteps([])
    setFinished(false)

    const timers: ReturnType<typeof setTimeout>[] = []

    STEPS.forEach((_, i) => {
      // Mark each step as done sequentially
      timers.push(setTimeout(() => {
        setCurrentStep(i + 1)
        setDoneSteps(prev => [...prev, i])
      }, 600 + i * 700))
    })

    // Finish after all steps
    timers.push(setTimeout(() => {
      setFinished(true)
      setTimeout(onComplete, 700)
    }, 600 + STEPS.length * 700 + 300))

    return () => timers.forEach(clearTimeout)
  }, [stockName])

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(10,13,25,0.88)', backdropFilter: 'blur(6px)' }}
    >
      {/* Radar circle */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Radar */}
        <div className="relative w-32 h-32">
          {/* Outer rings */}
          <div className="absolute inset-0 rounded-full border border-secondary/20" />
          <div className="absolute inset-4 rounded-full border border-secondary/15" />
          <div className="absolute inset-8 rounded-full border border-secondary/10" />

          {/* Sweep */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="absolute bottom-1/2 left-1/2 w-1/2 h-px origin-left radar-sweep"
              style={{
                background: 'linear-gradient(to right, transparent, rgba(6,182,212,0.9))',
                transformOrigin: '0% 50%',
              }}
            />
            {/* Fading sector */}
            <div
              className="absolute inset-0 rounded-full radar-sweep"
              style={{
                background: 'conic-gradient(from 0deg, rgba(6,182,212,0.18) 0deg, rgba(6,182,212,0.0) 60deg, transparent 60deg)',
              }}
            />
          </div>

          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary glow-cyan" />
          </div>

          {/* Blip dots — appear as steps complete */}
          {doneSteps.length >= 1 && (
            <div className="absolute" style={{ top: '22%', left: '65%' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary relative">
                <div className="absolute inset-0 rounded-full bg-primary news-ping" />
              </div>
            </div>
          )}
          {doneSteps.length >= 2 && (
            <div className="absolute" style={{ top: '58%', left: '72%' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary relative">
                <div className="absolute inset-0 rounded-full bg-primary news-ping" />
              </div>
            </div>
          )}
          {doneSteps.length >= 3 && (
            <div className="absolute" style={{ top: '35%', left: '18%' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-bull relative">
                <div className="absolute inset-0 rounded-full bg-bull news-ping" />
              </div>
            </div>
          )}
        </div>

        {/* Stock name */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap size={13} className="text-secondary" />
            <span className="text-xs font-mono text-secondary uppercase tracking-widest">AI 분석 스캐너</span>
          </div>
          <span className="text-sm font-mono font-bold text-foreground">{stockName}</span>
        </div>

        {/* Steps */}
        <div className="space-y-2 min-w-[280px]">
          {STEPS.map((step, i) => {
            const isDone = doneSteps.includes(i)
            const isActive = currentStep === i && !isDone

            return (
              <div
                key={step.id}
                className="flex items-center gap-2.5 step-reveal"
                style={{ animationDelay: `${i * 0.12}s`, opacity: 0, animationFillMode: 'forwards' }}
              >
                {isDone ? (
                  <CheckCircle2 size={14} className="text-bull shrink-0" />
                ) : isActive ? (
                  <Loader2 size={14} className="text-secondary shrink-0 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                )}
                <span className={`text-[11px] font-mono transition-colors ${
                  isDone ? 'text-bull' : isActive ? 'text-secondary' : 'text-muted-foreground/50'
                }`}>
                  {isDone ? step.done : step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Completion flash */}
        {finished && (
          <div className="flex items-center gap-2 bg-primary/15 border border-primary/40 glow-amber rounded-lg px-4 py-2 step-reveal"
            style={{ animationFillMode: 'forwards' }}
          >
            <Diamond size={13} fill="#f59e0b" className="text-primary" />
            <span className="text-xs font-mono font-bold text-primary text-glow-amber">Buy Signal 생성 완료</span>
          </div>
        )}
      </div>
    </div>
  )
}
