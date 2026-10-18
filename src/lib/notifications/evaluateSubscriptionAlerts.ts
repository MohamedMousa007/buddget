/**
 * Pure evaluation of subscription notifications for the daily cron: one digest of charges
 * coming up, a trial ending, a price rise. Nothing for paused or cancelled subscriptions.
 * Idempotent through the dedupe keys, like the debt alerts beside it.
 */
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import type { Expense, Subscription } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { chargeAmount, cycleState, lifecycle } from '@/lib/subscriptions/subscriptionForecast'
import { priceChange } from '@/lib/subscriptions/subscriptionPricing'
import { money2 } from '@/lib/subscriptions/subscriptionFormat'

/** Days before a charge that the digest mentions it. Yearly plans get a longer lead. */
export const REMIND_DAYS = [3, 0] as const
export const REMIND_DAYS_YEARLY = [7, 1] as const
/** Days before a trial's last day that it is flagged. */
export const TRIAL_ALERT_DAYS = [2, 0] as const

export interface DigestItem {
  name: string
  amount: number
  currency: string
  daysUntil: number
}

export type SubscriptionAlert =
  | { type: 'subscription_digest'; dedupeKey: string; severity: 'info'; items: DigestItem[] }
  | { type: 'subscription_trial'; dedupeKey: string; severity: 'warning'; name: string; daysLeft: number; amount: number; currency: string; endsOn: string }
  | { type: 'subscription_price'; dedupeKey: string; severity: 'info'; name: string; from: number; to: number; currency: string }

export interface EvaluateSubscriptionAlertsInput {
  today: Date
  subscriptions: Subscription[]
  expenses: Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind' | 'amount' | 'currency' | 'amountInBaseCurrency'>[]
  dueReminders: boolean
  priceAlerts: boolean
}

export function evaluateSubscriptionAlerts(input: EvaluateSubscriptionAlertsInput): SubscriptionAlert[] {
  const now = startOfDay(input.today)
  const ymd = format(now, 'yyyy-MM-dd')
  const out: SubscriptionAlert[] = []
  const digest: DigestItem[] = []

  for (const sub of input.subscriptions) {
    const life = lifecycle(sub, now)
    if (sub.reminder === false) continue

    if (life === 'trial' && input.priceAlerts && sub.trialEnd) {
      const left = differenceInCalendarDays(parseISO(sub.trialEnd.slice(0, 10)), now)
      if ((TRIAL_ALERT_DAYS as readonly number[]).includes(left)) {
        out.push({
          type: 'subscription_trial',
          dedupeKey: `sub_trial:${sub.id}:${sub.trialEnd.slice(0, 10)}:${left}`,
          severity: 'warning',
          name: sub.name,
          daysLeft: left,
          amount: chargeAmount(sub),
          currency: sub.currency,
          endsOn: sub.trialEnd.slice(0, 10),
        })
      }
      continue
    }
    if (life !== 'active') continue

    if (input.priceAlerts) {
      const pc = priceChange(sub, input.expenses)
      if (pc) {
        out.push({
          type: 'subscription_price',
          dedupeKey: `sub_price:${sub.id}:${pc.to}`,
          severity: 'info',
          name: sub.planName ? `${sub.name} ${sub.planName}` : sub.name,
          from: pc.from,
          to: pc.to,
          currency: sub.currency,
        })
      }
    }

    if (input.dueReminders) {
      const c = cycleState(sub, input.expenses, now)
      const windows: readonly number[] = sub.billingCycle === 'yearly' ? REMIND_DAYS_YEARLY : REMIND_DAYS
      const days = c.kind === 'upcoming' ? c.daysUntil : 0
      if (c.kind === 'today' || (c.kind === 'upcoming' && windows.includes(days))) {
        digest.push({ name: sub.name, amount: chargeAmount(sub), currency: sub.currency, daysUntil: days })
      }
    }
  }

  if (digest.length > 0) {
    out.unshift({
      type: 'subscription_digest',
      dedupeKey: `sub_digest:${ymd}`,
      severity: 'info',
      items: digest.sort((a, b) => a.daysUntil - b.daysUntil),
    })
  }
  return out
}

/** Localized {title, body} for an alert, from the server dictionary. */
export function renderSubscriptionAlert(dict: Dictionary, a: SubscriptionAlert): { title: string; body: string } {
  const n = dict.subscriptions.ui.notifications
  switch (a.type) {
    case 'subscription_digest':
      return {
        title: n.digestTitle(a.items.length),
        body: a.items.map((i) => n.digestItem(i.name, money2(i.amount), n.inDays(i.daysUntil))).join(' · '),
      }
    case 'subscription_trial':
      return { title: n.trialTitle(a.name, a.daysLeft), body: n.trialBody(money2(a.amount), a.endsOn) }
    case 'subscription_price':
      return { title: n.priceTitle(a.name, money2(a.to)), body: n.priceBody(money2(a.from)) }
  }
}
