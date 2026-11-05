'use client'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { resolveWeekStart, weekendFirstDayFor, type WeekStartDay } from '@/lib/time/weekStart'
import type { WeekendFirstDay } from '@/lib/utils/paydaySchedule'

export function useWeekStart(): WeekStartDay {
  const weekStartDay = useFinanceStore((s) => s.settings.weekStartDay)
  const timezone = useFinanceStore((s) => s.settings.timezone)
  return resolveWeekStart({ weekStartDay, timezone })
}

/** First day of the employer weekend (Fri for a Saturday-first week, else Sat); shifts paydays off it. */
export function useWeekendFirstDay(): WeekendFirstDay {
  const weekStartDay = useFinanceStore((s) => s.settings.weekStartDay)
  const timezone = useFinanceStore((s) => s.settings.timezone)
  return weekendFirstDayFor({ weekStartDay, timezone })
}
