'use client'

import { useEffect } from 'react'
import { cycleKeyFor } from '@/lib/settings/payCycle'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Points the app's active month at the cycle that contains today. The month key is the month a
 * cycle starts in, so with a pay cycle starting on the 25th the calendar month would land on
 * a cycle that has not begun. Runs when data is ready and whenever the start day changes.
 */
export function useCycleAwareMonth() {
  const ready = useFinanceStore((s) => s.dataReady)
  const startDay = useFinanceStore((s) => s.settings.monthStartDay)
  const setMonthFilter = useSettingsStore((s) => s.setMonthFilter)

  useEffect(() => {
    if (ready) setMonthFilter(cycleKeyFor(new Date(), startDay))
  }, [ready, startDay, setMonthFilter])
}
