'use client'

import { useEffect, useRef } from 'react'

/**
 * Runs `fn` every `ms` while `enabled` and the app is in the foreground, and once more as soon as it comes back.
 * A hidden tab or a backgrounded app never polls.
 */
export function useForegroundPoll(fn: () => void, ms: number, enabled: boolean): void {
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    let id: number | null = null
    const start = () => {
      if (id === null) id = window.setInterval(() => ref.current(), ms)
    }
    const stop = () => {
      if (id !== null) window.clearInterval(id)
      id = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ref.current()
        start()
      } else stop()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ms, enabled])
}
