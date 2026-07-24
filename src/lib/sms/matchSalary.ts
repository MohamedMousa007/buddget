/**
 * Salary dedup: reconcile an incoming income SMS against the user's declared
 * recurring salary so a paycheck SMS does not double-count.
 *
 * `calculateMonthlyIncome` already counts a recurring salary once per period, so
 * a confident match must NOT create a new income row — we only acknowledge
 * receipt. A close-but-off amount (e.g. a raise) asks the user to confirm; an
 * unmatched credit falls through to normal one-time income capture.
 *
 * A match also reports WHICH payday it fulfils. Without that, the event is stamped
 * with no `occurrence_date` and `buildOccurrences` pairs it POSITIONALLY: a 20 Jul
 * paycheck banked on 3 Aug fills August's first payday and leaves July's 20th
 * showing "Missed" — both months wrong. Payroll platforms (Deel, Wise, Payoneer)
 * make that the normal case, not the edge case.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, parseISO } from 'date-fns'
import { paydayDatesForWindow, toISODate } from '@/lib/utils/paydaySchedule'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { Currency, IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

export type SalaryDecision =
  | { outcome: 'matched'; sourceId: string; occurrenceDate: string }
  | { outcome: 'confirm'; sourceId: string; occurrenceDate: string | null }
  | { outcome: 'create' }

const EXACT_TOLERANCE = 0.02 // ±2% → auto-match
const CONFIRM_TOLERANCE = 0.15 // ±2%–15% → ask the user (raise / deduction)

/** Widest drift tolerated when the source declares none. */
export const DEFAULT_DRIFT_DAYS = 7

/** Assumed spacing when a source somehow yields fewer than two paydays in a quarter. */
const FALLBACK_GAP_DAYS = 30

/** Row shape this module reads. Kept explicit so the SELECT and the mapper can't drift apart. */
interface SalaryRow {
  id: string
  amount: number
  currency: string
  recurring_frequency: string | null
  day_of_month: number | null
  payday_days: number[] | null
  payday_drift_days: number | null
  effective_start: string | null
  effective_end: string | null
}

const SALARY_COLUMNS =
  'id, amount, currency, recurring_frequency, day_of_month, payday_days, payday_drift_days, effective_start, effective_end'

/**
 * DB row → the shape `paydaySchedule` reads. Only the scheduling fields are real; the rest
 * exist to satisfy the domain type and are never read by `paydayDatesForWindow`.
 */
function toScheduleSource(row: SalaryRow): IncomeSource {
  return {
    id: row.id,
    name: '',
    amount: row.amount,
    currency: row.currency as Currency,
    isRecurring: true,
    recurringFrequency: (row.recurring_frequency ?? 'monthly') as IncomeRecurringFrequency,
    dayOfMonth: row.day_of_month ?? undefined,
    paydayDays: row.payday_days ?? undefined,
    effectiveStart: row.effective_start ?? '1970-01-01',
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * Smallest gap between consecutive paydays, sampled over a quarter.
 *
 * Bounds the match window: a ±7-day window is meaningless for a weekly salary whose
 * paydays are 7 days apart — it would reach every one of them and the "nearest payday"
 * would be a coin flip. Half the gap is the widest window that can never be ambiguous.
 */
function minPaydayGapDays(source: IncomeSource, around: Date): number {
  const dates = paydayDatesForWindow(source, addDays(around, -46), addDays(around, 46))
  if (dates.length < 2) return FALLBACK_GAP_DAYS
  let min = Infinity
  for (let i = 1; i < dates.length; i++) {
    min = Math.min(min, Math.round((dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000))
  }
  return min > 0 && Number.isFinite(min) ? min : FALLBACK_GAP_DAYS
}

/**
 * Paydays this credit could plausibly fulfil, nearest first, plus how far the nearest one
 * sits from the credit. Spans month boundaries — a 30 Jul payday banked on 2 Aug is not in
 * August's schedule, so a "this month's paydays" search would never find it.
 */
function candidatePaydays(row: SalaryRow, dayISO: string): { paydays: string[]; distanceDays: number } {
  const source = toScheduleSource(row)
  const day = parseISO(dayISO)
  const requested = row.payday_drift_days ?? DEFAULT_DRIFT_DAYS
  const window = Math.max(1, Math.min(requested, Math.floor(minPaydayGapDays(source, day) / 2)))
  const ranked = paydayDatesForWindow(source, addDays(day, -window), addDays(day, window))
    .map((d) => ({ iso: toISODate(d), dist: Math.abs(d.getTime() - day.getTime()) }))
    .sort((a, b) => a.dist - b.dist)
  return {
    paydays: ranked.map((c) => c.iso),
    distanceDays: ranked.length ? Math.round(ranked[0].dist / 86_400_000) : Infinity,
  }
}

/** True when the source was still running on this day. An ended salary matches nothing. */
function activeOn(row: SalaryRow, dayISO: string): boolean {
  if (row.effective_start && dayISO < row.effective_start) return false
  if (row.effective_end && dayISO > row.effective_end) return false
  return true
}

export async function matchSalary(
  service: SupabaseClient,
  params: {
    userId: string
    amount: number
    currency: string
    day: string
    exchangeRates?: Record<string, number>
  },
): Promise<SalaryDecision> {
  const { data: sources } = await service
    .from('income_sources')
    .select(SALARY_COLUMNS)
    .eq('user_id', params.userId)
    .eq('source_type', 'salary')
    .eq('is_recurring', true)
    .is('deleted_at', null)

  const salaries = (sources ?? []) as unknown as SalaryRow[]
  if (salaries.length === 0) return { outcome: 'create' }

  const rates = params.exchangeRates ?? {}
  type Candidate = {
    row: SalaryRow
    diff: number
    sameCurrency: boolean
    paydays: string[]
    distanceDays: number
  }
  let best: Candidate | null = null

  for (const row of salaries) {
    if (!row.amount || !activeOn(row, params.day)) continue

    // Cross-currency is allowed but never trusted outright — see the `matched` gate below.
    const sameCurrency = row.currency === params.currency
    const inSourceCurrency = sameCurrency
      ? params.amount
      : tryConvertCurrency(params.amount, params.currency, row.currency, rates)
    if (inSourceCurrency == null) continue

    const diff = Math.abs(inSourceCurrency - row.amount) / row.amount
    if (diff > CONFIRM_TOLERANCE) continue

    const candidate: Candidate = { row, diff, sameCurrency, ...candidatePaydays(row, params.day) }
    // Closest amount wins. Two salaries of the same size are told apart only by WHEN they
    // land, so a tie goes to the one whose payday sits nearer the credit — array order
    // would otherwise decide it, which is no decision at all.
    const better =
      !best ||
      candidate.diff < best.diff - 1e-9 ||
      (Math.abs(candidate.diff - best.diff) <= 1e-9 && candidate.distanceDays < best.distanceDays)
    if (better) best = candidate
  }

  if (!best) return { outcome: 'create' }

  // Never claim a payday that already holds an event: a second credit inside the same window
  // is a bonus or a correction, not the same paycheck arriving twice. If every payday in
  // range is settled, this is genuinely new money and stays an unlinked one-time credit.
  const free = best.paydays.length ? await firstUnfilledPayday(service, params.userId, best.row.id, best.paydays) : null
  if (best.paydays.length > 0 && free === null) return { outcome: 'create' }

  // Auto-link only when nothing was inferred: the amount is right to the cent-ish, the
  // currency needed no conversion (an FX move and a raise are indistinguishable once
  // converted), and the credit actually lands on a scheduled payday.
  if (best.diff <= EXACT_TOLERANCE && best.sameCurrency && free) {
    return { outcome: 'matched', sourceId: best.row.id, occurrenceDate: free }
  }
  return { outcome: 'confirm', sourceId: best.row.id, occurrenceDate: free }
}

/**
 * The nearest candidate payday with no event already stamped on it.
 *
 * ponytail: the half-gap cap means the window can normally hold only ONE payday, so this
 * usually decides between one candidate and none. It still walks the list because an even
 * gap admits an exact midpoint tie — cheap to handle, wrong to assume away.
 */
async function firstUnfilledPayday(
  service: SupabaseClient,
  userId: string,
  templateId: string,
  paydays: string[],
): Promise<string | null> {
  const { data } = await service
    .from('income_events')
    .select('occurrence_date')
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .is('deleted_at', null)
    .in('occurrence_date', paydays)

  const taken = new Set((data ?? []).map((r) => r.occurrence_date as string))
  return paydays.find((p) => !taken.has(p)) ?? null
}
