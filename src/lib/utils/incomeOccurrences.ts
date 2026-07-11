import { addDays, isWithinInterval, parseISO } from 'date-fns'
import { getMonthRange, incomeMonthlyMultiplier, recurringActiveForWindow } from '@/lib/utils/calculations'
import type { Currency, IncomeEvent, IncomeSource } from '@/lib/store/types'

/**
 * Display status of a single payday. Distinct from {@link IncomeEvent.status}
 * (which has no `awaiting`): an awaiting occurrence has no ledger event yet, and
 * an overdue payday stays `awaiting` — it is never auto-flipped to `missed`.
 */
export type IncomeOccurrenceStatus = 'received' | 'late' | 'partial' | 'missed' | 'awaiting'

export interface IncomeOccurrence {
  /** Stable key: the paired event id, else `<sourceId>@<payday ISO>`. */
  key: string
  /** `YYYY-MM-DD`. Payday for awaiting; the event's received date once logged. */
  date: string
  status: IncomeOccurrenceStatus
  /** Expected-per-payday for awaiting; the actual amount once logged (partial stores the lower one). */
  amount: number
  currency: Currency
  /** Ledger row this occurrence resolves to, when logged. */
  eventId?: string
}

const EVENT_STATUS: Record<IncomeEvent['status'], IncomeOccurrenceStatus | null> = {
  confirmed: 'received',
  late: 'late',
  partial: 'partial',
  missed: 'missed',
  projected: null,
}

/** Realized statuses that count toward actual income (missed does not). */
export const REALIZED_STATUSES: ReadonlySet<IncomeOccurrenceStatus> = new Set([
  'received',
  'late',
  'partial',
])

/** Money the user has actually declared for a source this month, in its own currency. */
export function realizedForOccurrences(occ: IncomeOccurrence[]): number {
  return occ.reduce((sum, o) => (REALIZED_STATUSES.has(o.status) ? sum + o.amount : sum), 0)
}

/** Expected per single paycheck. `source.amount` is already per-payday for weekly/biweekly. */
export function expectedPerPayday(source: IncomeSource): number {
  return source.amount
}

/** Monthly-equivalent big number: per-payday × cadence multiplier. */
export function monthlyEquivalent(source: IncomeSource): number {
  return source.amount * incomeMonthlyMultiplier(source.recurringFrequency)
}

/** Sorted payday dates for a source inside the given month window. */
function paydayDates(source: IncomeSource, start: Date, end: Date): Date[] {
  const anchorDom = source.dayOfMonth ?? 1
  const freq = source.recurringFrequency ?? 'monthly'

  if (freq === 'monthly') {
    // Single payday on the anchor day, clamped to the month's length.
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    const day = Math.min(anchorDom, daysInMonth)
    const d = new Date(start.getFullYear(), start.getMonth(), day)
    return isWithinInterval(d, { start, end }) ? [d] : []
  }

  // Weekly/biweekly: anchor on the anchor day, derive the rest by stepping.
  const step = freq === 'weekly' ? 7 : 14
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const anchor = new Date(start.getFullYear(), start.getMonth(), Math.min(anchorDom, daysInMonth))
  const dates: Date[] = []
  // Walk backward to the first payday inside the window, then forward across it.
  let cursor = anchor
  while (cursor >= start) cursor = addDays(cursor, -step)
  cursor = addDays(cursor, step)
  while (cursor <= end) {
    if (cursor >= start) dates.push(cursor)
    cursor = addDays(cursor, step)
  }
  return dates
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Expand a recurring source into this month's payday occurrences, pairing each
 * (in date order) with the source's realized ledger events. Unpaired paydays are
 * `awaiting`; surplus events (more receipts than paydays) append as extra chips.
 */
export function buildOccurrences(
  source: IncomeSource,
  events: IncomeEvent[],
  monthStr: string,
  monthStartDay = 1,
): IncomeOccurrence[] {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  if (!recurringActiveForWindow(source, start, end)) return []

  const realized = events
    .filter((e) => e.templateId === source.id && EVENT_STATUS[e.status] !== null)
    .filter((e) => isWithinInterval(parseISO(e.receivedDate), { start, end }))
    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate) || a.createdAt.localeCompare(b.createdAt))

  const paydays = paydayDates(source, start, end)
  const expected = expectedPerPayday(source)
  const occ: IncomeOccurrence[] = paydays.map((d, i) => {
    const ev = realized[i]
    if (ev) {
      return {
        key: ev.id,
        date: ev.receivedDate,
        status: EVENT_STATUS[ev.status] as IncomeOccurrenceStatus,
        amount: ev.amount,
        currency: ev.currency,
        eventId: ev.id,
      }
    }
    return {
      key: `${source.id}@${toISO(d)}`,
      date: toISO(d),
      status: 'awaiting',
      amount: expected,
      currency: source.currency,
    }
  })

  // Extra receipts beyond the payday count are still real money — show them.
  for (let i = paydays.length; i < realized.length; i++) {
    const ev = realized[i]
    occ.push({
      key: ev.id,
      date: ev.receivedDate,
      status: EVENT_STATUS[ev.status] as IncomeOccurrenceStatus,
      amount: ev.amount,
      currency: ev.currency,
      eventId: ev.id,
    })
  }

  return occ.sort((a, b) => a.date.localeCompare(b.date))
}

/** Index of the next payday still awaiting money (assign/mark default). -1 if none. */
export function nextAwaitingIndex(occ: IncomeOccurrence[]): number {
  return occ.findIndex((o) => o.status === 'awaiting')
}
