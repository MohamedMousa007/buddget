'use client'

import { useEffect } from 'react'
import { cycleKeyFor } from '@/lib/settings/payCycle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

const ROLLOVER_CHECK_MS = 60_000

/** The month to show after the clock may have crossed a cycle boundary: someone on the old current cycle follows it, someone browsing history stays. */
export function monthAfterRollover(viewed: string, previousCurrent: string, current: string): string {
  return viewed === previousCurrent ? current : viewed
}

/**
 * Points the app's active month at the cycle that contains today. The month key is the month a
 * cycle starts in, so with a pay cycle starting on the 25th the calendar month would land on
 * a cycle that has not begun. Runs when data is ready and whenever the start day changes, and
 * follows the clock across a cycle boundary (app resumed from background, or left open overnight).
 */
export function useCycleAwareMonth() {
  const ready = useFinanceStore((s) => s.dataReady)
  const startDay = useFinanceStore((s) => s.settings.monthStartDay)
  const setMonthFilter = useSettingsStore((s) => s.setMonthFilter)

  useEffect(() => {
    if (!ready) return
    let current = cycleKeyFor(new Date(), startDay)
    setMonthFilter(current)
    const check = () => {
      const next = cycleKeyFor(new Date(), startDay)
      if (next === current) return
      setMonthFilter(monthAfterRollover(useSettingsStore.getState().monthFilter, current, next))
      current = next
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, ROLLOVER_CHECK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [ready, startDay, setMonthFilter])
}
