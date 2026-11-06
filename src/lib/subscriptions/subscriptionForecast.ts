import { differenceInCalendarDays, endOfMonth, format, isSameDay, parseISO, startOfDay, startOfMonth } from 'date-fns'
import { addCalendarDays } from '@/lib/time/calendarDays'
import type { Currency, Expense, Subscription } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { expenseAmountInBase } from '@/lib/utils/calculations'
import { advanceCycle, firstBillingOnOrAfter } from './subscriptionDates'
import { cycleWindow, isCyclePaid } from './subscriptionOccurrence'
import { subscriptionToMonthlyPlannerAmount } from './subscriptionRecurring'

/** Days after a due date before an unrecorded charge counts as "expected, not seen". */
export const OVERDUE_GRACE_DAYS = 3

type Schedule = Pick<Subscription, 'id' | 'startDate' | 'billingDay' | 'billingCycle'>
type Billable = Schedule &
  Pick<Subscription, 'name' | 'status' | 'amount' | 'currency' | 'myShare' | 'trialEnd' | 'endsOn' | 'createdAt'>
type PaidProbe = Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind'>

export type Lifecycle = 'active' | 'trial' | 'paused' | 'cancelled' | 'ended'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const day = (s: string) => startOfDay(parseISO(s.slice(0, 10)))

/** What the user pays per charge: their share of a shared plan, else the full price. */
export function chargeAmount(sub: Pick<Subscription, 'amount' | 'myShare'>): number {
  return sub.myShare ?? sub.amount
}

/**
 * Where a subscription is in its life as of `today`. A trial whose last day has passed bills
 * like an active plan (it converts unless the user cancelled); a cancelled one stays
 * "cancelled" while access remains, then moves to Ended.
 */
export function lifecycle(
  sub: Pick<Subscription, 'status' | 'trialEnd' | 'endsOn'>,
  today: Date = new Date()
): Lifecycle {
  const t = iso(startOfDay(today))
  if (sub.status === 'cancelled') return sub.endsOn && sub.endsOn.slice(0, 10) >= t ? 'cancelled' : 'ended'
  if (sub.status === 'paused') return 'paused'
  if (sub.status === 'trial') return sub.trialEnd && sub.trialEnd.slice(0, 10) < t ? 'active' : 'trial'
  return 'active'
}

/** True while the subscription still bills (active, or a trial that has converted). */
export const isCharging = (sub: Pick<Subscription, 'status' | 'trialEnd' | 'endsOn'>, today?: Date) =>
  lifecycle(sub, today) === 'active'

/**
 * First day a charge can be expected. Cycles that opened before the user added the
 * subscription were never tracked, so nothing about them is "missing".
 */
export function trackedFrom(sub: Pick<Subscription, 'startDate' | 'createdAt'>): Date {
  const start = day(sub.startDate)
  const created = startOfDay(parseISO(sub.createdAt))
  return created > start ? created : start
}

/** Scheduled charge dates inside [from, to], inclusive. Weekly steps 7 days from the start date. */
export function scheduledDates(sub: Schedule, from: Date, to: Date): Date[] {
  const start = day(sub.startDate)
  const billingDay = sub.billingDay || start.getDate()
  const step = (d: Date) => advanceCycle(d, billingDay, sub.billingCycle)
  let d = sub.billingCycle === 'weekly' ? start : firstBillingOnOrAfter(start, billingDay)
  const lo = startOfDay(from)
  const hi = startOfDay(to)
  const out: Date[] = []
  for (let guard = 0; d <= hi && guard < 6000; guard++) {
    if (d >= lo) out.push(d)
    d = step(d)
  }
  return out
}

export type CycleKind = 'upcoming' | 'today' | 'grace' | 'overdue'

export interface CycleState {
  /** The charge date this subscription is currently about. */
  due: Date
  kind: CycleKind
  /** Calendar days from today to `due`; negative once it has passed. */
  daysUntil: number
}

/**
 * The charge the user should be looking at: the cycle that opened on or before today if its
 * charge has not landed, otherwise the next one. Unpaid cycles go from `today` (day 0) to
 * `grace` (1-2 days) to `overdue` (3+ days) — "expected, not seen".
 */
export function cycleState(sub: Billable, expenses: PaidProbe[], today: Date = new Date()): CycleState {
  const now = startOfDay(today)
  const win = cycleWindow(sub, now)
  const opened = win.start <= now && win.end > win.start
  const expected = opened && win.start >= trackedFrom(sub)
  if (expected && !isCyclePaid(sub, expenses, now)) {
    const late = differenceInCalendarDays(now, win.start)
    return {
      due: win.start,
      kind: late === 0 ? 'today' : late < OVERDUE_GRACE_DAYS ? 'grace' : 'overdue',
      daysUntil: -late,
    }
  }
  // "Mark paid" ahead of the due date records the charge on that date; the schedule has moved on.
  let due = win.end
  if (isCyclePaid(sub, expenses, due)) due = cycleWindow(sub, due).end
  return { due, kind: 'upcoming', daysUntil: differenceInCalendarDays(due, now) }
}

/** "Mark paid" can pay the next charge ahead of time, but only this close to its due date. */
export const PAY_AHEAD_DAYS = 7

/**
 * The charge "Mark paid" would record: the open unpaid cycle, else the next one (paying
 * ahead, within {@link PAY_AHEAD_DAYS}). Null when there is nothing to pay yet.
 */
export function markPaidTarget(sub: Billable, expenses: PaidProbe[], today: Date = new Date()): Date | null {
  const now = startOfDay(today)
  const state = cycleState(sub, expenses, now)
  if (state.kind !== 'upcoming') return now
  const win = cycleWindow(sub, now)
  const next = win.end
  // A cycle no longer than the pay-ahead window (weekly) has no "ahead": paying it would be a second charge in a row.
  if (differenceInCalendarDays(next, win.start) <= PAY_AHEAD_DAYS) return null
  if (differenceInCalendarDays(next, now) > PAY_AHEAD_DAYS) return null
  return isCyclePaid(sub, expenses, next) ? null : next
}

export interface Forecast {
  sub: Billable
  due: Date
  amount: number
  /** `amount` in the base currency. */
  amountBase: number
  kind: CycleKind
}

/**
 * Charges still to come, within `horizonDays` of today, for subscriptions that actually bill.
 * Includes an unrecorded charge that is already due. A paid cycle is not forecast again.
 */
export function forecastCharges(
  subs: Billable[],
  expenses: PaidProbe[],
  today: Date,
  horizonDays: number,
  baseCurrency: Currency,
  rates: Record<string, number>
): Forecast[] {
  const now = startOfDay(today)
  const limit = addCalendarDays(now, horizonDays)
  const out: Forecast[] = []
  for (const sub of subs) {
    if (!isCharging(sub, now)) continue
    const amount = chargeAmount(sub)
    const amountBase = convertCurrency(amount, sub.currency, baseCurrency, rates)
    const state = cycleState(sub, expenses, now)
    if (state.kind !== 'upcoming') out.push({ sub, due: state.due, amount, amountBase, kind: state.kind })
    for (const d of scheduledDates(sub, state.kind === 'upcoming' ? state.due : addCalendarDays(now, 1), limit)) {
      if (d > now && isCyclePaid(sub, expenses, d)) continue
      out.push({ sub, due: d, amount, amountBase, kind: isSameDay(d, now) ? 'today' : 'upcoming' })
    }
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime())
}

export interface MonthCharge {
  sub: Billable
  due: Date
  /** In the base currency. */
  amountBase: number
}

/**
 * Charges due this calendar month and not yet recorded. Uses real due dates (a quarterly plan
 * counts in the month it bills). Yearly plans are left to {@link yearlySetAside} for Budget;
 * the Subscriptions hero passes `includeYearly`.
 */
export function chargesLeftThisMonth(
  subs: Billable[],
  expenses: PaidProbe[],
  today: Date,
  baseCurrency: Currency,
  rates: Record<string, number>,
  includeYearly = false
): MonthCharge[] {
  const now = startOfDay(today)
  const lo = startOfMonth(now)
  const hi = endOfMonth(now)
  const out: MonthCharge[] = []
  for (const sub of subs) {
    if (!isCharging(sub, now)) continue
    if (!includeYearly && sub.billingCycle === 'yearly') continue
    const from = trackedFrom(sub)
    const amountBase = convertCurrency(chargeAmount(sub), sub.currency, baseCurrency, rates)
    for (const d of scheduledDates(sub, lo, hi)) {
      if (d < from) continue
      if (!isCyclePaid(sub, expenses, d)) out.push({ sub, due: d, amountBase })
    }
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime())
}

/** Sum of {@link chargesLeftThisMonth}, in the base currency. */
export function leftToPayThisMonth(
  subs: Billable[],
  expenses: PaidProbe[],
  today: Date,
  baseCurrency: Currency,
  rates: Record<string, number>,
  includeYearly = false
): number {
  return chargesLeftThisMonth(subs, expenses, today, baseCurrency, rates, includeYearly).reduce((a, c) => a + c.amountBase, 0)
}

/** Money to put aside each month for yearly plans: amount / 12, charged plans only. */
export function yearlySetAside(
  subs: Billable[],
  today: Date,
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  let sum = 0
  for (const sub of subs) {
    if (sub.billingCycle !== 'yearly' || !isCharging(sub, today)) continue
    sum += convertCurrency(chargeAmount(sub) / 12, sub.currency, baseCurrency, rates)
  }
  return sum
}

/** Sum of everything recorded against a subscription this calendar month (base currency). */
export function paidThisMonth(
  expenses: Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind' | 'amount' | 'currency' | 'amountInBaseCurrency'>[],
  today: Date,
  baseCurrency: Currency,
  rates: Record<string, number>
): number {
  const key = format(today, 'yyyy-MM')
  return expenses.reduce(
    (sum, e) =>
      e.linkedSubscriptionId && e.date.slice(0, 7) === key ? sum + expenseAmountInBase(e, baseCurrency, rates) : sum,
    0
  )
}

export interface HeroNumbers {
  due30: number
  paid: number
  left: number
  monthlyEquivalent: number
  perYear: number
  next: { sub: Billable; due: Date } | null
}

/** Everything the Subscriptions hero band shows. */
export function heroNumbers(
  subs: Billable[],
  expenses: (PaidProbe & Pick<Expense, 'amount' | 'currency' | 'amountInBaseCurrency'>)[],
  today: Date,
  baseCurrency: Currency,
  rates: Record<string, number>
): HeroNumbers {
  const forecast = forecastCharges(subs, expenses, today, 30, baseCurrency, rates)
  let monthlyEquivalent = 0
  for (const sub of subs) {
    if (!isCharging(sub, today)) continue
    monthlyEquivalent += convertCurrency(
      subscriptionToMonthlyPlannerAmount(chargeAmount(sub), sub.billingCycle),
      sub.currency,
      baseCurrency,
      rates
    )
  }
  const upcoming = forecast.find((f) => f.kind === 'today' || f.kind === 'upcoming')
  return {
    due30: forecast.reduce((a, f) => a + f.amountBase, 0),
    paid: paidThisMonth(expenses, today, baseCurrency, rates),
    left: leftToPayThisMonth(subs, expenses, today, baseCurrency, rates, true),
    monthlyEquivalent,
    perYear: monthlyEquivalent * 12,
    next: upcoming ? { sub: upcoming.sub, due: upcoming.due } : null,
  }
}
