import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Currency, Expense, Subscription } from '@/lib/store/types'
import {
  chargeAmount,
  cycleState,
  lifecycle,
  type CycleState,
  type Lifecycle,
} from './subscriptionForecast'
import { fxEstimate, FX_DRIFT_THRESHOLD, lastCharge, priceChange, type PriceChange } from './subscriptionPricing'
import { cycleWindow } from './subscriptionOccurrence'
import { subscriptionStatus, type SubscriptionDisplayStatus } from './subscriptionStatus'
import { subscriptionToMonthlyPlannerAmount } from './subscriptionRecurring'

export type GroupKey = 'overdue' | 'week' | 'month' | 'later' | 'yearly'
export type Segment = 'upcoming' | 'all' | 'ended'

export type ChipKey =
  | 'inDays'
  | 'today'
  | 'trialEnds'
  | 'paused'
  | 'ends'
  | 'expected'
  | 'price'
  | 'planChanges'
  | 'failed'
  | 'shared'
  | 'estimate'
  | 'yearly'
  | 'active'
export type ChipTone = 'neutral' | 'amber' | 'info' | 'success'
export type ChipIcon = 'clock' | 'trending-up' | 'repeat' | 'triangle-alert' | 'users' | 'check'

export interface Chip {
  key: ChipKey
  tone: ChipTone
  icon?: ChipIcon
  /** inDays: day count · price: signed percent · shared: head count */
  n?: number
  /** ends / planChanges: ISO date */
  date?: string
}

/** The line under the amount, as data so the view owns wording and formatting. */
export type AmountNote =
  | { kind: 'foreign'; amount: number; currency: Currency; fxDrift?: number }
  | { kind: 'perMonth'; amount: number }
  | { kind: 'was'; amount: number }
  | { kind: 'myShare'; of: number }

type RowSub = Subscription
type RowExpense = Pick<
  Expense,
  'linkedSubscriptionId' | 'date' | 'refundKind' | 'amount' | 'currency' | 'amountInBaseCurrency'
>

export interface RowModel {
  sub: RowSub
  life: Lifecycle
  cycle: CycleState | null
  /** ISO date shown on the row; null while paused. An unpaid cycle keeps its past due date here. */
  date: string | null
  /** The next charge on or after today: an unpaid past cycle rolls forward to the one after it. */
  nextDue: string | null
  chip: Chip
  /** The derived status badge (the same one the subscription sheet shows). */
  status: SubscriptionDisplayStatus
  group: GroupKey | null
  /** The amount is a forecast that is not being charged (trial, paused, cancelled). */
  struck: boolean
  /** Shown amount: ≈ base-currency estimate for a foreign plan, else the charge. */
  amount: number
  approx: boolean
  note: AmountNote | null
  priceChange: PriceChange | null
  /** The day this month's charge was recorded (today's calendar month), else null. */
  paidOn: string | null
}

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A declined charge inside the current cycle: the bank refused it. */
function failedThisCycle(sub: RowSub, expenses: RowExpense[], today: Date): boolean {
  const { start, end } = cycleWindow(sub, today)
  if (end <= start) return false
  return expenses.some(
    (e) =>
      e.linkedSubscriptionId === sub.id &&
      e.refundKind === 'declined' &&
      e.date.slice(0, 10) >= localIso(start) &&
      e.date.slice(0, 10) < localIso(end)
  )
}

function dueChip(c: CycleState): Chip {
  if (c.kind === 'today') return { key: 'today', tone: 'amber', icon: 'clock' }
  return { key: 'inDays', tone: c.daysUntil <= 3 ? 'amber' : 'neutral', icon: c.daysUntil <= 3 ? 'clock' : undefined, n: c.daysUntil }
}

const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

/** "This month" holds only charges in today's calendar month; a date in next month is Later, however close. */
export function groupFor(c: CycleState, yearly: boolean, today: Date): GroupKey {
  if (c.kind === 'overdue') return 'overdue'
  if (yearly) return 'yearly'
  if (c.daysUntil <= 7) return 'week'
  return sameMonth(c.due, today) ? 'month' : 'later'
}

/** Builds everything a row needs to render from one subscription. Pure; `today` is explicit. */
export function buildRow(
  sub: RowSub,
  expenses: RowExpense[],
  today: Date,
  baseCurrency: Currency,
  rates: Record<string, number>
): RowModel {
  const now = startOfDay(today)
  const life = lifecycle(sub, now)
  const charging = life === 'active'
  const cycle = charging ? cycleState(sub, expenses, now) : null
  const pc = charging ? priceChange(sub, expenses) : null
  const foreign = sub.currency !== baseCurrency
  const fx = foreign ? fxEstimate(sub, baseCurrency, rates, expenses) : null
  const charge = chargeAmount(sub)
  const yearly = sub.billingCycle === 'yearly'

  let date: string | null = null
  if (life === 'paused') date = null
  else if (life === 'cancelled' || life === 'ended') date = sub.endsOn?.slice(0, 10) ?? null
  else if (life === 'trial') date = sub.trialEnd?.slice(0, 10) ?? null
  else if (cycle) date = localIso(cycle.due)

  let chip: Chip
  if (life === 'paused') chip = { key: 'paused', tone: 'neutral' }
  else if (life === 'cancelled' || life === 'ended') chip = { key: 'ends', tone: 'neutral', date: date ?? undefined }
  else if (life === 'trial') chip = { key: 'trialEnds', tone: 'info', icon: 'clock' }
  else if (failedThisCycle(sub, expenses, now)) chip = { key: 'failed', tone: 'amber', icon: 'triangle-alert' }
  else if (cycle?.kind === 'overdue') chip = { key: 'expected', tone: 'amber', icon: 'clock' }
  else if (pc) chip = { key: 'price', tone: 'amber', icon: 'trending-up', n: pc.pct }
  else if (sub.pendingPlanId && sub.pendingPlanFrom)
    chip = { key: 'planChanges', tone: 'info', icon: 'repeat', date: sub.pendingPlanFrom.slice(0, 10) }
  else if (sub.sharedWith?.length) chip = { key: 'shared', tone: 'info', icon: 'users', n: sub.sharedWith.length + 1 }
  else if (yearly) chip = { key: 'yearly', tone: 'neutral' }
  else if (foreign && fx && !fx.refined && !lastCharge(sub.id, expenses) && cycle && cycle.daysUntil > 7)
    chip = { key: 'estimate', tone: 'neutral' }
  else chip = cycle ? dueChip(cycle) : { key: 'active', tone: 'neutral' }

  const approx = foreign
  const amount = fx ? fx.estimate : charge
  let note: AmountNote | null = null
  if (foreign) {
    note = {
      kind: 'foreign',
      amount: charge,
      currency: sub.currency,
      fxDrift: fx && fx.refined && Math.abs(fx.drift) >= FX_DRIFT_THRESHOLD ? fx.drift : undefined,
    }
  } else if (pc) note = { kind: 'was', amount: pc.from }
  else if (sub.myShare != null && sub.myShare !== sub.amount) note = { kind: 'myShare', of: sub.amount }
  else if (yearly) note = { kind: 'perMonth', amount: subscriptionToMonthlyPlannerAmount(charge, 'yearly') }

  // A pending plan change shows the new price with the old one beneath; a price rise shows what was last charged.
  const planMoved = sub.pendingPlanId && sub.pendingAmount != null && !foreign
  if (planMoved) note = { kind: 'was', amount: charge }
  const shownAmount = planMoved ? (sub.pendingAmount as number) : pc && !foreign ? pc.to : amount

  return {
    sub,
    life,
    cycle,
    date,
    nextDue: cycle && (cycle.kind === 'grace' || cycle.kind === 'overdue') ? localIso(cycleWindow(sub, now).end) : date,
    chip,
    status: subscriptionStatus(sub, expenses, now),
    group: cycle ? groupFor(cycle, yearly, now) : life === 'trial' ? trialGroup(sub, now, yearly) : null,
    struck: life === 'trial' || life === 'paused' || life === 'cancelled' || life === 'ended',
    amount: shownAmount,
    approx,
    note,
    priceChange: pc,
    paidOn: paidOnThisMonth(sub.id, expenses, now),
  }
}

/** The latest real charge recorded against the subscription inside today's calendar month. */
function paidOnThisMonth(subId: string, expenses: RowExpense[], today: Date): string | null {
  const month = localIso(today).slice(0, 7)
  let best: string | null = null
  for (const e of expenses) {
    if (e.linkedSubscriptionId !== subId || e.refundKind) continue
    const d = e.date.slice(0, 10)
    if (d.slice(0, 7) === month && (!best || d > best)) best = d
  }
  return best
}

function trialGroup(sub: RowSub, now: Date, yearly: boolean): GroupKey {
  if (yearly) return 'yearly'
  const end = sub.trialEnd ? parseISO(sub.trialEnd.slice(0, 10)) : now
  const days = differenceInCalendarDays(end, now)
  return days <= 7 ? 'week' : sameMonth(end, now) ? 'month' : 'later'
}

/** Upcoming as the Light touch mockup lists it: what is due in the next 30 days, then what was paid this month. */
export type HomeGroupKey = 'next30' | 'paid' | 'later' | 'all' | 'ended'

/** How far ahead "Next 30 days" looks. */
export const NEXT_DAYS = 30

export interface RowGroup {
  key: HomeGroupKey
  rows: RowModel[]
  /** Sum of charging rows, base currency. */
  total: number
}

function sortByDate(a: RowModel, b: RowModel): number {
  return (a.date ?? '9999').localeCompare(b.date ?? '9999')
}

export interface HomeLists {
  groups: RowGroup[]
  /** Subscriptions that count as "active". */
  activeCount: number
}

const daysAhead = (r: RowModel, today: Date) => (r.date ? differenceInCalendarDays(parseISO(r.date), startOfDay(today)) : Infinity)

/**
 * Rows for a segment.
 * - Upcoming: "Next 30 days" (overdue, due or a trial ending within 30 days), "Paid this month" (charged this calendar
 *   month; such a plan leaves the timeline until next month), then "Later" for anything further out.
 * - All: every plan, flat.
 * - Ended: cancelled plans (still running to their end date or past it) and legacy paused ones; they never sit in Upcoming.
 */
export function buildHomeLists(
  segment: Segment,
  rows: RowModel[],
  toBase: (r: RowModel) => number,
  today: Date = new Date()
): HomeLists {
  const total = (list: RowModel[]) => list.filter((r) => r.life === 'active').reduce((a, r) => a + toBase(r), 0)
  const activeCount = rows.filter((r) => r.life === 'active' || r.life === 'trial').length
  if (segment === 'ended') {
    const list = rows.filter((r) => r.life === 'cancelled' || r.life === 'ended' || r.life === 'paused').sort(sortByDate)
    return { groups: list.length ? [{ key: 'ended', rows: list, total: 0 }] : [], activeCount }
  }
  if (segment === 'all') {
    const list = [...rows].sort(sortByDate)
    return { groups: list.length ? [{ key: 'all', rows: list, total: total(list) }] : [], activeCount }
  }
  const live = rows.filter((r) => r.life === 'active' || r.life === 'trial')
  const paid = live.filter((r) => r.life === 'active' && r.paidOn).sort((a, b) => (b.paidOn ?? '').localeCompare(a.paidOn ?? ''))
  const paidIds = new Set(paid.map((r) => r.sub.id))
  const open = live.filter((r) => !paidIds.has(r.sub.id) && r.group !== null)
  const next30 = open.filter((r) => r.group === 'overdue' || daysAhead(r, today) <= NEXT_DAYS).sort(sortByDate)
  const later = open.filter((r) => !next30.includes(r)).sort(sortByDate)
  const groups: RowGroup[] = [
    { key: 'next30' as const, rows: next30, total: total(next30) },
    { key: 'paid' as const, rows: paid, total: paid.reduce((a, r) => a + toBase(r), 0) },
    { key: 'later' as const, rows: later, total: total(later) },
  ].filter((g) => g.rows.length > 0)
  return { groups, activeCount }
}
