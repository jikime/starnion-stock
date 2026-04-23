'use client'

import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Shortcut {
  keys: string[]
  desc: string
}

interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: '네비게이션',
    items: [
      { keys: ['⌘', 'K'], desc: '종목 검색 (명령 팔레트)' },
      { keys: ['Ctrl', 'K'], desc: '종목 검색 (Windows/Linux)' },
      { keys: ['Esc'], desc: '검색/다이얼로그 닫기' },
    ],
  },
  {
    title: '도움말',
    items: [
      { keys: ['?'], desc: '이 단축키 목록 열기' },
      { keys: ['Shift', '/'], desc: '이 단축키 목록 열기 (대체)' },
    ],
  },
  {
    title: '차트 조작',
    items: [
      { keys: ['마우스 휠'], desc: '차트 확대/축소' },
      { keys: ['드래그'], desc: '차트 좌우 이동 (pan)' },
      { keys: ['마우스오버'], desc: '캔들 OHLC 상세 정보' },
    ],
  },
  {
    title: '사이드바 패널',
    items: [
      { keys: ['클릭'], desc: '각 아이콘 클릭으로 패널 열기/닫기' },
      { keys: ['관심종목'], desc: '종목명 옆 ⭐ 클릭으로 추가/제거' },
    ],
  },
]


export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // '?' 는 Shift+/ 이므로 e.key === '?' 로 체크 가능
      if (e.key !== '?') return

      // input/textarea/contentEditable 에 포커스가 있으면 무시
      const el = document.activeElement as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      ) {
        return
      }

      e.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md border-border"
        style={{ background: 'rgb(20, 25, 45)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <Keyboard size={16} className="text-primary" />
            키보드 단축키
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUTS.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </div>
              <ul className="space-y-1.5">
                {group.items.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-xs font-sans"
                  >
                    <span className="text-foreground/80">{s.desc}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-mono text-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="pt-2 border-t border-border/30">
            <p className="text-[10px] font-mono text-muted-foreground/70 text-center">
              언제든 <kbd className="rounded border border-border/60 bg-muted/30 px-1 text-[9px]">?</kbd>{' '}
              키로 이 창을 다시 열 수 있습니다.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
