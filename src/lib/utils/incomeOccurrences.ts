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
  const expected = expectedPerPayday(source)

  // Merge this source's in-window events by received date, so multiple receipts
  // on the SAME day collapse into one chip (summed) instead of duplicate same-date
  // chips. Progress is unchanged — the summed amount is preserved.
  const byDate = new Map<string, IncomeEvent[]>()
  for (const e of events) {
    if (e.templateId !== source.id || EVENT_STATUS[e.status] === null) continue
    if (!isWithinInterval(parseISO(e.receivedDate), { start, end })) continue
    const arr = byDate.get(e.receivedDate)
    if (arr) arr.push(e)
    else byDate.set(e.receivedDate, [e])
  }
  const realized = [...byDate.entries()]
    .map(([date, evs]) => {
      evs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      // Single event: trust its stored status/amount verbatim.
      if (evs.length === 1) {
        return {
          date,
          status: EVENT_STATUS[evs[0].status] as IncomeOccurrenceStatus,
          amount: evs[0].amount,
          currency: evs[0].currency,
          eventId: evs[0].id,
        }
      }
      // Multiple receipts on the same day: sum realized money + derive one status.
      const realizedSum = evs.reduce(
        (s, e) => (REALIZED_STATUSES.has(EVENT_STATUS[e.status] as IncomeOccurrenceStatus) ? s + e.amount : s),
        0,
      )
      const anyRealized = evs.some((e) => REALIZED_STATUSES.has(EVENT_STATUS[e.status] as IncomeOccurrenceStatus))
      const allLate = evs.every((e) => e.status === 'late')
      const status: IncomeOccurrenceStatus = !anyRealized
        ? 'missed'
        : realizedSum >= expected
          ? allLate
            ? 'late'
            : 'received'
          : 'partial'
      return { date, status, amount: anyRealized ? realizedSum : evs[0].amount, currency: evs[0].currency, eventId: evs[0].id }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const paydays = paydayDates(source, start, end)
  const occ: IncomeOccurrence[] = paydays.map((d, i) => {
    const ev = realized[i]
    if (ev) {
      return { key: ev.eventId, date: ev.date, status: ev.status, amount: ev.amount, currency: ev.currency, eventId: ev.eventId }
    }
    return {
      key: `${source.id}@${toISO(d)}`,
      date: toISO(d),
      status: 'awaiting',
      amount: expected,
      currency: source.currency,
    }
  })

  // Extra received dates beyond the scheduled payday count are still real money —
  // show them as their own (distinct-date) chips.
  for (let i = paydays.length; i < realized.length; i++) {
    const ev = realized[i]
    occ.push({ key: ev.eventId, date: ev.date, status: ev.status, amount: ev.amount, currency: ev.currency, eventId: ev.eventId })
  }

  return occ.sort((a, b) => a.date.localeCompare(b.date))
}

/** Index of the next payday still awaiting money (assign/mark default). -1 if none. */
export function nextAwaitingIndex(occ: IncomeOccurrence[]): number {
  return occ.findIndex((o) => o.status === 'awaiting')
}
