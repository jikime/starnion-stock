'use client'

import { Award, BookOpen, Crown, Flame } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PhilosophyTab {
  id: 'buffett' | 'oneill' | 'livermore'
  label: string
  nameEn: string
  Icon: typeof Crown
  color: string
  tagline: string
  description: string
  criteria: { label: string; weight: string; detail: string }[]
  signal: string
  weakness: string
}

const TABS: PhilosophyTab[] = [
  {
    id: 'buffett',
    label: '워런 버핏',
    nameEn: 'Warren Buffett',
    Icon: Crown,
    color: '#f59e0b',
    tagline: 'Safety First — 저평가 우량주',
    description:
      '기업의 내재가치 대비 저평가된 우량주를 장기 보유. "훌륭한 기업을 합리적 가격에 사서 영원히 보유"를 원칙으로, 경제적 해자(Moat)와 수익성, 재무 건전성을 중시한다. 투기 회피, 감정 배제.',
    criteria: [
      {
        label: 'ROE (자기자본이익률)',
        weight: '30점',
        detail: '>15% 우수 / >10% 양호. 핵심 수익성 지표. 주주 자본으로 얼마나 효율적으로 돈을 버는지.',
      },
      {
        label: '부채비율',
        weight: '20점',
        detail: '<50% 매우 안전 / <80% 한국형 안전. 재무 건전성. 부채가 지나치면 경기 하강기 리스크.',
      },
      {
        label: 'PER (주가수익비율)',
        weight: '25점',
        detail: '<10 매우 저평가 / <15 저평가. 이익 대비 주가. 싸게 살수록 안전마진 확보.',
      },
      {
        label: 'PBR (주가순자산비율)',
        weight: '15점',
        detail: '<1 청산가치 미만 / <2 저평가. 순자산 대비 주가.',
      },
      {
        label: '배당수익률',
        weight: '10점',
        detail: '≥3% 양호. 한국형 추가 조건 — 주주 환원 의지 확인.',
      },
    ],
    signal: '"싸졌을 때 (Underpriced)" — 펀더멘탈 건전 + 가격 저평가 동시 만족',
    weakness: '단기 급등주 놓침. 가치 함정(Value Trap)에 빠질 수 있음.',
  },
  {
    id: 'oneill',
    label: '윌리엄 오닐',
    nameEn: "William O'Neil",
    Icon: Award,
    color: '#06b6d4',
    tagline: 'High Momentum — CAN SLIM 성장 주도주',
    description:
      'CAN SLIM 전략의 창시자. 분기 이익이 폭증하는 시장 주도주를 신고가 돌파 시점에 매수. "비싸 보여도 더 비싸질 것"을 전제로 모멘텀과 수급을 중시. 기계적 7~8% 손절.',
    criteria: [
      {
        label: '순이익 YoY (C)',
        weight: '20점',
        detail: '>50% 폭증 / >25% 기준 충족. CAN SLIM의 C — 분기 이익 가속화가 주도주의 전조.',
      },
      {
        label: '가격 모멘텀 20일',
        weight: '15점',
        detail: '>25% 강한 모멘텀. 시장이 주도주로 인정한 상승세.',
      },
      {
        label: '신고가 근접 (N)',
        weight: '20점',
        detail: '고점 대비 ≥95% (-5% 이내) / ≥90% (-10%). 신고가 돌파 = 모든 저항 극복.',
      },
      {
        label: '거래량 급증',
        weight: '15점',
        detail: '최근 5일 평균/이전 20일 평균. >2× 폭증 = Strong Demand 확인.',
      },
      {
        label: 'RSI > 70 (주도주)',
        weight: '10점',
        detail: '"시장 주도주는 대부분 RSI 70 이상". 과매수가 아니라 강세 확인.',
      },
      {
        label: '[한국형] 외국인 5일 순매수',
        weight: '20점',
        detail: '4일 연속 순매수 = 20점 만점. 한국 시장은 외인 수급이 주도주 판별의 결정적 지표.',
      },
    ],
    signal: '"최고가 돌파 시 (Breakout)" — 실적 + 모멘텀 + 수급 3박자',
    weakness: '신고가 추격은 손절 원칙이 깨지면 큰 손실. 횡보장에 약함.',
  },
  {
    id: 'livermore',
    label: '제시 리버모어',
    nameEn: 'Jesse Livermore',
    Icon: Flame,
    color: '#f97316',
    tagline: 'Trend Follower — 대장주의 변곡점',
    description:
      '20세기 초 전설적 투기꾼. "가격과 거래량만으로 시장의 본질을 읽는다." 추세가 확실할 때만 진입, 전환점(Pivot)에서 매수, 추세가 깨지면 5% 이내 칼손절. 계량적 관찰 + 감정 통제.',
    criteria: [
      {
        label: '[한국형] MA 다중 정배열',
        weight: '25점',
        detail: 'Price > MA20 > MA60 > MA120 > MA200. 5단 완벽 정배열 = 25점. 장기 추세 확인.',
      },
      {
        label: '4주 변화율',
        weight: '15점',
        detail: '>20% 강한 가속 / >10% 추세 가속화. 돌파 후 모멘텀 지속성.',
      },
      {
        label: '피벗 R1 돌파',
        weight: '15점',
        detail: '전일 H/L/C 기준 Classic Pivot. R1 돌파 = 전환점 확인.',
      },
      {
        label: '[한국형] 거래량 ×2',
        weight: '20점',
        detail: '>3× 전환점 / >2× 폭발. 추세 돌파에는 거래량이 따라줘야 진짜.',
      },
      {
        label: 'ADX 추세 강도',
        weight: '10점',
        detail: '>30 강한 추세 / >20 추세 형성. 방향성 유무 판별.',
      },
      {
        label: 'MACD 골든크로스',
        weight: '15점',
        detail: 'MACD > Signal. 중기 추세 전환 확인.',
      },
    ],
    signal: '"추세 확인 시 (Pivot)" — 정배열 + 피벗 돌파 + 거래량 폭발',
    weakness: '횡보장·급변동장 약함. 감정 통제 실패 시 치명적 (리버모어 본인도 파산).',
  },
]


export function MasterPhilosophyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeId, setActiveId] = useState<PhilosophyTab['id']>('buffett')
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0]
  const Icon = active.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border-border"
        style={{ background: 'rgb(20, 25, 45)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <BookOpen size={16} className="text-primary" />
            거장 철학 가이드
          </DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="flex gap-1 shrink-0">
          {TABS.map((tab) => {
            const TabIcon = tab.Icon
            const active = activeId === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveId(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono rounded border transition-colors ${
                  active
                    ? 'border-primary/40'
                    : 'border-border/40 text-muted-foreground hover:text-foreground'
                }`}
                style={active ? { background: `${tab.color}15`, color: tab.color } : {}}
              >
                <TabIcon size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar pr-1">
          {/* 타이틀 + 태그라인 */}
          <div className="pb-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Icon size={18} style={{ color: active.color }} />
              <div>
                <div className="text-base font-display font-bold text-foreground">
                  {active.label}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {active.nameEn} · {active.tagline}
                </div>
              </div>
            </div>
          </div>

          {/* 철학 요약 */}
          <div className="py-3 border-b border-border/30">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
              철학
            </div>
            <p className="text-xs font-sans text-foreground leading-relaxed">
              {active.description}
            </p>
          </div>

          {/* 점수 기준 */}
          <div className="py-3 border-b border-border/30">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              점수 계산 기준 (총 100점)
            </div>
            <div className="space-y-2">
              {active.criteria.map((c) => (
                <div
                  key={c.label}
                  className="rounded-lg border border-border/40 bg-muted/10 p-2.5"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-mono font-bold text-foreground">
                      {c.label}
                    </span>
                    <span
                      className="text-[10px] font-mono font-bold rounded px-1.5 py-0.5"
                      style={{
                        background: `${active.color}20`,
                        color: active.color,
                      }}
                    >
                      {c.weight}
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
                    {c.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 매수 시그널 + 약점 */}
          <div className="py-3 space-y-2">
            <div>
              <div className="text-[10px] font-mono text-bull uppercase tracking-wider mb-1">
                매수 시그널
              </div>
              <p className="text-xs font-sans text-foreground">{active.signal}</p>
            </div>
            <div>
              <div className="text-[10px] font-mono text-bear uppercase tracking-wider mb-1">
                약점 / 주의
              </div>
              <p className="text-xs font-sans text-foreground/80">{active.weakness}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
