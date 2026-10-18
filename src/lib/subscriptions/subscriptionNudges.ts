import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import type { Currency } from '@/lib/store/types'
import { chargeAmount, scheduledDates } from './subscriptionForecast'
import { trackingAction } from './subscriptionTracking'
import type { RowModel } from './subscriptionRows'

export type NudgeKind = 'ask' | 'price' | 'trial' | 'plan' | 'still'

export interface Nudge {
  kind: NudgeKind
  row: RowModel
  /** Stable per occurrence, so dismissing it does not silence the next one. */
  key: string
}

/** Days before a trial's last day that the nudge starts showing. */
export const TRIAL_NUDGE_DAYS = 2

function monthKey(today: Date) {
  return format(today, 'yyyy-MM')
}

/**
 * At most one nudge, in priority order: a due charge to confirm, a price rise, a trial
 * ending, a plan that moved up, then a monthly "still using it?". Dismissed keys are skipped.
 */
export function pickNudge(rows: RowModel[], today: Date, dismissed: ReadonlySet<string>): Nudge | null {
  const now = startOfDay(today)
  const candidates: Nudge[] = []

  for (const row of rows) {
    const { sub, cycle } = row
    if (row.life === 'active' && cycle && trackingAction(sub.tracking, cycle) === 'ask') {
      candidates.push({ kind: 'ask', row, key: `subnudge:ask:${sub.id}:${format(cycle.due, 'yyyy-MM-dd')}` })
    }
  }
  for (const row of rows) {
    if (row.priceChange) {
      candidates.push({ kind: 'price', row, key: `subnudge:price:${row.sub.id}:${row.priceChange.to}` })
    }
  }
  for (const row of rows) {
    if (row.life === 'trial' && row.sub.trialEnd) {
      const left = differenceInCalendarDays(parseISO(row.sub.trialEnd.slice(0, 10)), now)
      if (left >= 0 && left <= TRIAL_NUDGE_DAYS) {
        candidates.push({ kind: 'trial', row, key: `subnudge:trial:${row.sub.id}:${row.sub.trialEnd.slice(0, 10)}` })
      }
    }
  }
  for (const row of rows) {
    if (row.life === 'active' && row.sub.pendingPlanId) {
      candidates.push({ kind: 'plan', row, key: `subnudge:plan:${row.sub.id}:${row.sub.pendingPlanId}` })
    }
  }

  const monthly = rows
    .filter((r) => r.life === 'active' && r.sub.billingCycle === 'monthly')
    .sort((a, b) => b.amount - a.amount)[0]
  if (monthly) {
    candidates.push({ kind: 'still', row: monthly, key: `subnudge:still:${monthly.sub.id}:${monthKey(now)}` })
  }

  return candidates.find((c) => !dismissed.has(c.key)) ?? null
}

export interface StripDay {
  date: Date
  isToday: boolean
  /** A charge is scheduled for this day. */
  due: boolean
}

/** The desktop rail's 30-day strip: today plus 29 days, flagging days with a scheduled charge. */
export function thirtyDayStrip(rows: RowModel[], today: Date): StripDay[] {
  const now = startOfDay(today)
  const end = addDays(now, 29)
  const dueKeys = new Set<string>()
  for (const row of rows) {
    if (row.life !== 'active') continue
    if (row.cycle && row.cycle.kind !== 'upcoming') dueKeys.add(format(row.cycle.due, 'yyyy-MM-dd'))
    for (const d of scheduledDates(row.sub, now, end)) dueKeys.add(format(d, 'yyyy-MM-dd'))
  }
  return Array.from({ length: 30 }, (_, i) => {
    const date = addDays(now, i)
    return { date, isToday: i === 0, due: dueKeys.has(format(date, 'yyyy-MM-dd')) }
  })
}

export type Insight =
  | { kind: 'price'; row: RowModel }
  | { kind: 'trial'; row: RowModel; amount: number; currency: Currency }

/** Rail insight cards: price changes first, then trials ending. Never more than two. */
export function railInsights(rows: RowModel[]): Insight[] {
  const out: Insight[] = []
  for (const row of rows) if (row.priceChange) out.push({ kind: 'price', row })
  for (const row of rows) {
    if (row.life === 'trial') {
      out.push({ kind: 'trial', row, amount: chargeAmount(row.sub), currency: row.sub.currency })
    }
  }
  return out.slice(0, 2)
}
