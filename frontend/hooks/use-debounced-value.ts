'use client'

import { useEffect, useState } from 'react'

/**
 * 값이 일정 시간 동안 변경되지 않을 때만 최신 값을 반환한다.
 * API 호출을 쿼리 입력마다 폭주시키지 않기 위해 사용.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
