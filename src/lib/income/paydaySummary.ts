import { format, parseISO, subMonths } from 'date-fns'
import { buildOccurrences, isRealizedOccurrence, missedAfterDaysFor, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { toISODate } from '@/lib/utils/paydaySchedule'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

const DAY = 86_400_000

/** Days an unpaid payday is overdue, or 0 when it is not yet past due. */
export function overdueDays(occ: IncomeOccurrence, today: Date): number {
  const todayISO = toISODate(today)
  if (occ.eventId || occ.dueDate >= todayISO) return 0
  return Math.round((parseISO(todayISO).getTime() - parseISO(occ.dueDate).getTime()) / DAY)
}

/** Past its grace with nothing recorded — the "N days late" state. */
export function isLate(source: IncomeSource, occ: IncomeOccurrence, today: Date): boolean {
  return overdueDays(occ, today) > missedAfterDaysFor(source)
}

/** The last `n` paydays up to the end of `month`, oldest first (the timeline on Payday detail). */
export function recentPaydays(
  source: IncomeSource,
  events: IncomeEvent[],
  month: string,
  monthStartDay: number,
  n: number,
  today: Date,
): IncomeOccurrence[] {
  const out: IncomeOccurrence[] = []
  const anchor = parseISO(`${month}-01`)
  for (let back = 0; back < 12 && out.length < n; back++) {
    const m = format(subMonths(anchor, back), 'yyyy-MM')
    out.unshift(...buildOccurrences(source, events, m, monthStartDay, today))
  }
  return out.slice(-n)
}

/**
 * The payday a card or the detail should talk about: the earliest one still open and due
 * (it is what needs an answer), else the latest settled one, else the next one coming.
 */
export function focusPayday(occ: IncomeOccurrence[], today: Date): IncomeOccurrence | undefined {
  const todayISO = toISODate(today)
  const openDue = occ.find((o) => !o.eventId && o.dueDate < todayISO)
  if (openDue) return openDue
  const settled = [...occ].reverse().find((o) => o.eventId)
  return settled ?? occ.find((o) => !o.eventId)
}

/** This month's recorded vs expected, in each source's own currency. */
export function monthProgress(source: IncomeSource, events: IncomeEvent[], month: string, monthStartDay: number) {
  const occ = buildOccurrences(source, events, month, monthStartDay)
  return {
    expected: occ.length * source.amount,
    received: occ.reduce((s, o) => (isRealizedOccurrence(o) ? s + o.amount : s), 0),
  }
}
