import { format, parseISO, subMonths } from 'date-fns'
import { convertCurrency } from '@/lib/utils/currency'
import { buildOccurrences, missedAfterDaysFor, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { toISODate } from '@/lib/utils/paydaySchedule'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

/**
 * What the Flow In segment has to ask the user about — and nothing else. Payday UI shows
 * only when it would change a number (brief §8): a payday past its grace with nothing
 * linked (it still counts as income), or a stray credit that is probably that payday
 * (it counts twice until linked).
 */

/** Same tolerance as `matchSalary`'s confirm band: a raise or a deduction still matches. */
export const MATCH_TOLERANCE = 0.15
/** How far a credit may land from its payday and still be offered as that payday. */
const MATCH_WINDOW_DAYS = 10
/** How far back a stray credit is still worth asking about. */
const MATCH_LOOKBACK_DAYS = 45

const REALIZED = new Set<IncomeEvent['status']>(['confirmed', 'late', 'partial'])
const DAY = 86_400_000

export interface OpenPayday {
  source: IncomeSource
  occ: IncomeOccurrence
}

export interface LatePayday extends OpenPayday {
  daysLate: number
}

export interface PaydayCandidate extends OpenPayday {
  /** |credit − expected| ÷ expected, in the source's currency. */
  diff: number
  /** Days between the credit and the payday. */
  distanceDays: number
  /** Within tolerance and window — a plausible "this is that payday". */
  plausible: boolean
}

export interface IncomeMatch extends PaydayCandidate {
  event: IncomeEvent
}

function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(parseISO(a).getTime() - parseISO(b).getTime()) / DAY)
}

/** Recurring paydays with nothing recorded against them, this month and last (a late one spans months). */
export function openPaydays(
  sources: IncomeSource[],
  events: IncomeEvent[],
  monthStartDay: number,
  today: Date,
): OpenPayday[] {
  const months = [format(subMonths(today, 1), 'yyyy-MM'), format(today, 'yyyy-MM')]
  const out: OpenPayday[] = []
  const seen = new Set<string>()
  for (const source of sources) {
    if (!source.isRecurring) continue
    for (const m of months) {
      for (const occ of buildOccurrences(source, events, m, monthStartDay, today)) {
        if (occ.eventId || seen.has(occ.key)) continue
        seen.add(occ.key)
        out.push({ source, occ })
      }
    }
  }
  return out
}

/** Unfilled paydays past their grace (`paydayDriftDays ?? 5`), oldest first. */
export function latePaydays(
  sources: IncomeSource[],
  events: IncomeEvent[],
  monthStartDay: number,
  today: Date,
): LatePayday[] {
  const todayISO = toISODate(today)
  return openPaydays(sources, events, monthStartDay, today)
    .filter(({ occ }) => occ.dueDate < todayISO)
    .map((p) => ({ ...p, daysLate: daysBetween(todayISO, p.occ.dueDate) }))
    .filter((p) => p.daysLate > missedAfterDaysFor(p.source))
    .sort((a, b) => a.occ.dueDate.localeCompare(b.occ.dueDate))
}

/**
 * Every open payday a credit could be linked to, best first: plausible matches (amount
 * within tolerance, date within the window) by amount then distance, then the rest by
 * distance. The Link sheet lists these; the match prompt uses the first plausible one.
 */
export function paydayCandidates(
  credit: Pick<IncomeEvent, 'amount' | 'currency' | 'receivedDate'>,
  sources: IncomeSource[],
  events: IncomeEvent[],
  monthStartDay: number,
  rates: Record<string, number>,
  today: Date,
): PaydayCandidate[] {
  return openPaydays(sources, events, monthStartDay, today)
    .map((p) => {
      const inSource = convertCurrency(credit.amount, credit.currency, p.source.currency, rates)
      const diff = p.occ.amount > 0 ? Math.abs(inSource - p.occ.amount) / p.occ.amount : Infinity
      const distanceDays = daysBetween(credit.receivedDate, p.occ.dueDate)
      return { ...p, diff, distanceDays, plausible: diff <= MATCH_TOLERANCE && distanceDays <= MATCH_WINDOW_DAYS }
    })
    .sort((a, b) =>
      a.plausible !== b.plausible
        ? a.plausible ? -1 : 1
        : a.plausible
          ? a.diff - b.diff || a.distanceDays - b.distanceDays
          : a.distanceDays - b.distanceDays,
    )
}

/** The dismissal key for "Keep separate": that credit + that payday never asks again. */
export function matchKey(eventId: string, occKey: string): string {
  return `match:${eventId}:${occKey}`
}

/**
 * Unlinked credits that plausibly fill an open payday, most recent first. Pairs the user
 * already kept separate are skipped; each payday is claimed by at most one credit.
 */
export function incomeMatches(
  sources: IncomeSource[],
  events: IncomeEvent[],
  monthStartDay: number,
  rates: Record<string, number>,
  today: Date,
  dismissed: readonly string[],
): IncomeMatch[] {
  const since = toISODate(new Date(today.getTime() - MATCH_LOOKBACK_DAYS * DAY))
  const credits = events
    .filter((e) => !e.templateId && REALIZED.has(e.status) && e.receivedDate >= since && !e.linkedDebtId && !e.linkedSavingsAccountId)
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
  const claimed = new Set<string>()
  const out: IncomeMatch[] = []
  for (const event of credits) {
    const best = paydayCandidates(event, sources, events, monthStartDay, rates, today).find(
      (c) => c.plausible && !claimed.has(c.occ.key) && !dismissed.includes(matchKey(event.id, c.occ.key)),
    )
    if (!best) continue
    claimed.add(best.occ.key)
    out.push({ ...best, event })
  }
  return out
}
