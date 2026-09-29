'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** A swiped-away status pill stays hidden this long, and returns only if its state still holds. */
const HIDE_MS = 10 * 60 * 1000

/** `[hidden, hide]` for the status pill `key`; re-renders on its own when the hide lapses. */
export function useHiddenStatus(key: string): [boolean, () => void] {
  const until = useSettingsStore((s) => s.hiddenStatusUntil[key])
  const hideStatus = useSettingsStore((s) => s.hideStatus)
  const [now, setNow] = useState(() => Date.now())
  const untilMs = until ? Date.parse(until) : 0

  useEffect(() => {
    if (untilMs <= now) return
    const id = window.setTimeout(() => setNow(Date.now()), untilMs - now + 50)
    return () => window.clearTimeout(id)
  }, [untilMs, now])

  const hide = () => {
    const at = Date.now()
    hideStatus(key, new Date(at + HIDE_MS).toISOString())
    setNow(at)
  }
  return [untilMs > now, hide]
}
