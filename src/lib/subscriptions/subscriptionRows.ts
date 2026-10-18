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
  /** ISO date shown on the row; null while paused. */
  date: string | null
  chip: Chip
  group: GroupKey | null
  /** The amount is a forecast that is not being charged (trial, paused, cancelled). */
  struck: boolean
  /** Shown amount: ≈ base-currency estimate for a foreign plan, else the charge. */
  amount: number
  approx: boolean
  note: AmountNote | null
  priceChange: PriceChange | null
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

export function groupFor(c: CycleState, yearly: boolean): GroupKey {
  if (c.kind === 'overdue') return 'overdue'
  if (yearly) return 'yearly'
  if (c.daysUntil <= 7) return 'week'
  if (c.daysUntil <= 14) return 'month'
  return 'later'
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
    chip,
    group: cycle ? groupFor(cycle, yearly) : life === 'trial' ? trialGroup(sub, now, yearly) : null,
    struck: life === 'trial' || life === 'paused' || life === 'cancelled' || life === 'ended',
    amount: shownAmount,
    approx,
    note,
    priceChange: pc,
  }
}

function trialGroup(sub: RowSub, now: Date, yearly: boolean): GroupKey {
  if (yearly) return 'yearly'
  const days = sub.trialEnd ? differenceInCalendarDays(parseISO(sub.trialEnd.slice(0, 10)), now) : 0
  return days <= 7 ? 'week' : days <= 14 ? 'month' : 'later'
}

export const GROUP_ORDER: GroupKey[] = ['overdue', 'week', 'month', 'later', 'yearly']

export interface RowGroup {
  key: GroupKey | 'all' | 'ended'
  rows: RowModel[]
  /** Sum of charging rows, base currency. */
  total: number
}

function sortByDate(a: RowModel, b: RowModel): number {
  return (a.date ?? '9999').localeCompare(b.date ?? '9999')
}

export interface HomeLists {
  groups: RowGroup[]
  paused: RowModel[]
  cancelled: RowModel[]
  /** Subscriptions that count as "active" in the period header. */
  activeCount: number
}

/** Rows for a segment: Upcoming (grouped timeline), All (flat), Ended (flat). */
export function buildHomeLists(
  segment: Segment,
  rows: RowModel[],
  toBase: (r: RowModel) => number
): HomeLists {
  const total = (list: RowModel[]) => list.filter((r) => r.life === 'active').reduce((a, r) => a + toBase(r), 0)
  const activeCount = rows.filter((r) => r.life === 'active' || r.life === 'trial').length
  const paused = rows.filter((r) => r.life === 'paused')
  const cancelled = rows.filter((r) => r.life === 'cancelled')
  if (segment === 'ended') {
    const list = rows.filter((r) => r.life === 'ended').sort(sortByDate)
    return { groups: list.length ? [{ key: 'ended', rows: list, total: 0 }] : [], paused: [], cancelled: [], activeCount }
  }
  if (segment === 'all') {
    const list = [...rows].sort(sortByDate)
    return { groups: list.length ? [{ key: 'all', rows: list, total: total(list) }] : [], paused: [], cancelled: [], activeCount }
  }
  const live = rows.filter((r) => r.group !== null)
  const groups = GROUP_ORDER.map((key) => {
    const list = live.filter((r) => r.group === key).sort(sortByDate)
    return { key, rows: list, total: total(list) }
  }).filter((g) => g.rows.length > 0)
  return { groups, paused, cancelled, activeCount }
}

