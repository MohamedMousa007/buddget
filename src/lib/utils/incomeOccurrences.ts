import { isWithinInterval, parseISO } from 'date-fns'
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { paydayDatesForWindow, toISODate } from '@/lib/utils/paydaySchedule'
import type { Currency, IncomeEvent, IncomeSource } from '@/lib/store/types'

/**
 * Display status of a single payday. Distinct from {@link IncomeEvent.status}
 * (which has no `awaiting`): an awaiting occurrence has no ledger event yet.
 * An overdue payday turns `late` (1–5 days past due) and then auto-displays as
 * `missed` (> {@link MISSED_AFTER_DAYS} days) — display-only, nothing persists
 * until the user acts.
 */
export type IncomeOccurrenceStatus = 'received' | 'late' | 'partial' | 'missed' | 'awaiting'

/** Days past the due date before an unactioned payday displays as missed. */
export const MISSED_AFTER_DAYS = 5

export interface IncomeOccurrence {
  /** Stable key: the paired event id, else `<sourceId>@<payday ISO>`. */
  key: string
  /** `YYYY-MM-DD` shown on the dot: the scheduled payday; surplus extras show their received date. */
  date: string
  /** `YYYY-MM-DD` scheduled payday this occurrence fulfills (pairing/dedupe key). */
  dueDate: string
  status: IncomeOccurrenceStatus
  /** Expected-per-payday for awaiting; the actual amount once logged (partial stores the lower one). */
  amount: number
  currency: Currency
  /** Ledger row this occurrence resolves to, when logged. */
  eventId?: string
  /**
   * Paydays are settled in sequence: only the earliest still-unactioned payday
   * (plus every event-backed or auto-missed one) can be status-actioned.
   */
  actionable: boolean
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

/** True when the occurrence has money actually logged (late without an event is just overdue). */
export function isRealizedOccurrence(o: IncomeOccurrence): boolean {
  return Boolean(o.eventId) && REALIZED_STATUSES.has(o.status)
}

/** Money the user has actually declared for a source this month, in its own currency. */
export function realizedForOccurrences(occ: IncomeOccurrence[]): number {
  return occ.reduce((sum, o) => (isRealizedOccurrence(o) ? sum + o.amount : sum), 0)
}

/** Expected per single paycheck. `source.amount` is already per-payday for weekly/biweekly. */
export function expectedPerPayday(source: IncomeSource): number {
  return source.amount
}

/** Computed display status for a payday with no ledger event yet. */
function pendingStatus(dueISO: string, todayISO: string): IncomeOccurrenceStatus {
  if (todayISO <= dueISO) return 'awaiting'
  const overdueDays = Math.round((parseISO(todayISO).getTime() - parseISO(dueISO).getTime()) / 86_400_000)
  return overdueDays <= MISSED_AFTER_DAYS ? 'late' : 'missed'
}

interface Realized {
  date: string
  status: IncomeOccurrenceStatus
  amount: number
  currency: Currency
  eventId: string
}

/** Collapse legacy (no occurrenceDate) same-day receipts into one entry, like the old chips. */
function mergeLegacyByDate(events: IncomeEvent[], expected: number): Realized[] {
  const byDate = new Map<string, IncomeEvent[]>()
  for (const e of events) {
    const arr = byDate.get(e.receivedDate)
    if (arr) arr.push(e)
    else byDate.set(e.receivedDate, [e])
  }
  return [...byDate.entries()]
    .map(([date, evs]) => {
      evs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      if (evs.length === 1) {
        return { date, status: EVENT_STATUS[evs[0].status] as IncomeOccurrenceStatus, amount: evs[0].amount, currency: evs[0].currency, eventId: evs[0].id }
      }
      const realizedSum = evs.reduce(
        (s, e) => (REALIZED_STATUSES.has(EVENT_STATUS[e.status] as IncomeOccurrenceStatus) ? s + e.amount : s),
        0,
      )
      const anyRealized = evs.some((e) => REALIZED_STATUSES.has(EVENT_STATUS[e.status] as IncomeOccurrenceStatus))
      const allLate = evs.every((e) => e.status === 'late')
      const status: IncomeOccurrenceStatus = !anyRealized ? 'missed' : realizedSum >= expected ? (allLate ? 'late' : 'received') : 'partial'
      return { date, status, amount: anyRealized ? realizedSum : evs[0].amount, currency: evs[0].currency, eventId: evs[0].id }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Expand a recurring source into this month's payday occurrences, pairing each
 * with the source's realized ledger events — by `occurrenceDate` when stamped
 * (the dedupe contract), positionally for legacy rows. Unpaired paydays get a
 * computed pending status; surplus legacy events append as extra entries.
 */
export function buildOccurrences(
  source: IncomeSource,
  events: IncomeEvent[],
  monthStr: string,
  monthStartDay = 1,
  today: Date = new Date(),
): IncomeOccurrence[] {
  const { start, end } = getMonthRange(monthStr, monthStartDay)
  if (!recurringActiveForWindow(source, start, end)) return []
  const expected = expectedPerPayday(source)
  const todayISO = toISODate(today)

  // Window-test by the fulfilled payday when stamped, else by received date —
  // a late paycheck logged next month still fills this month's payday.
  const byOcc = new Map<string, IncomeEvent>()
  const legacy: IncomeEvent[] = []
  for (const e of events) {
    if (e.templateId !== source.id || EVENT_STATUS[e.status] === null) continue
    if (!isWithinInterval(parseISO(e.occurrenceDate ?? e.receivedDate), { start, end })) continue
    if (e.occurrenceDate) {
      const prev = byOcc.get(e.occurrenceDate)
      if (!prev || e.updatedAt.localeCompare(prev.updatedAt) > 0) byOcc.set(e.occurrenceDate, e)
    } else {
      legacy.push(e)
    }
  }
  const legacyMerged = mergeLegacyByDate(legacy, expected)

  const paydays = paydayDatesForWindow(source, start, end)
  let li = 0
  const occ: IncomeOccurrence[] = paydays.map((d) => {
    const iso = toISODate(d)
    const direct = byOcc.get(iso)
    const ev: Realized | undefined = direct
      ? { date: iso, status: EVENT_STATUS[direct.status] as IncomeOccurrenceStatus, amount: direct.amount, currency: direct.currency, eventId: direct.id }
      : legacyMerged[li++]
    if (ev) {
      return { key: ev.eventId, date: iso, dueDate: iso, status: ev.status, amount: ev.amount, currency: ev.currency, eventId: ev.eventId, actionable: true }
    }
    return {
      key: `${source.id}@${iso}`,
      date: iso,
      dueDate: iso,
      status: pendingStatus(iso, todayISO),
      amount: expected,
      currency: source.currency,
      actionable: true, // sequence pass below demotes later pending paydays
    }
  })

  // Occurrence-dated events whose payday is no longer scheduled (schedule edited
  // after marking) and surplus legacy receipts are still real money — keep them
  // as extra entries.
  const pairedIds = new Set(occ.map((o) => o.eventId).filter(Boolean))
  for (const e of byOcc.values()) {
    if (pairedIds.has(e.id)) continue
    occ.push({ key: e.id, date: e.occurrenceDate!, dueDate: e.occurrenceDate!, status: EVENT_STATUS[e.status] as IncomeOccurrenceStatus, amount: e.amount, currency: e.currency, eventId: e.id, actionable: true })
  }
  for (; li < legacyMerged.length; li++) {
    const ev = legacyMerged[li]
    occ.push({ key: ev.eventId, date: ev.date, dueDate: ev.date, status: ev.status, amount: ev.amount, currency: ev.currency, eventId: ev.eventId, actionable: true })
  }
  occ.sort((a, b) => a.date.localeCompare(b.date))

  // Sequential settling: the earliest pending (awaiting/late) payday is the one
  // in turn; later event-less paydays wait. Auto-missed ones stay actionable so
  // the user can still log them.
  let turnTaken = false
  for (const o of occ) {
    if (o.eventId || o.status === 'missed') continue
    if (turnTaken) o.actionable = false
    else turnTaken = true
  }
  return occ
}

/** Index of the next payday still awaiting money (assign/mark default). -1 if none. */
export function nextAwaitingIndex(occ: IncomeOccurrence[]): number {
  const pending = occ.findIndex((o) => !o.eventId && o.status !== 'missed')
  return pending !== -1 ? pending : occ.findIndex((o) => !o.eventId)
}
