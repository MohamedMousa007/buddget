'use client'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveWeekStart, type WeekStartDay } from '@/lib/time/weekStart'

export function useWeekStart(): WeekStartDay {
  const weekStartDay = useFinanceStore((s) => s.settings.weekStartDay)
  const timezone = useFinanceStore((s) => s.settings.timezone)
  return resolveWeekStart({ weekStartDay, timezone })
}
