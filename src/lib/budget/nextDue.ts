import { getDaysInMonth } from 'date-fns'

export interface DueLine {
  dueDay: number | null
  paid: boolean
  amount: number
}

const onDay = (year: number, month: number, day: number) => {
  const first = new Date(year, month, 1)
  return new Date(year, month, Math.min(day, getDaysInMonth(first)))
}

/**
 * The next date a bill falls due: an unpaid line's due day this month (or next month once the day has passed), a paid
 * line's due day next month. The earliest wins; null when no line has a due day.
 */
export function nextDueDate(lines: readonly DueLine[], today: Date): Date | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  const startOfToday = new Date(y, m, today.getDate())
  let best: Date | null = null
  for (const l of lines) {
    if (l.dueDay == null || !(l.amount > 0)) continue
    const thisMonth = onDay(y, m, l.dueDay)
    const due = !l.paid && thisMonth >= startOfToday ? thisMonth : onDay(y, m + 1, l.dueDay)
    if (!best || due < best) best = due
  }
  return best
}
