import type { WeekSummary } from '@/lib/loyalty/loyaltyApi'

export interface WeekCheckState {
  /** The check should be offered now. */
  due: boolean
  /** The week the button keeps (a `YYYY-MM-DD` week start), or null when nothing can be kept. */
  week: 'last' | 'this' | null
}

const DAY = 86_400_000
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * When the weekly check is offered. Last week stays open for the first three days of a new week, so that is when it is asked for;
 * later in the week it comes back only for the last two days. The server enforces the real window; this only decides when to ask.
 */
export function weekCheckState(s: WeekSummary | null, now = new Date()): WeekCheckState {
  if (!s) return { due: false, week: null }
  if (s.lastWeekOpen && !s.lastWeekKept) return { due: true, week: 'last' }
  const intoWeek = Math.floor((Date.parse(`${ymd(now)}T00:00:00Z`) - Date.parse(`${s.thisWeek}T00:00:00Z`)) / DAY)
  const due = intoWeek >= 5 && !s.thisWeekKept
  return { due, week: due ? 'this' : s.thisWeekKept ? null : 'this' }
}
