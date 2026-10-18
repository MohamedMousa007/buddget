import type { Currency, Expense, Subscription } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { chargeAmount } from './subscriptionForecast'

/** A last charge that differs from the plan price by more than this is a price change. */
export const PRICE_CHANGE_THRESHOLD = 0.05
/** FX drift shown on a row once the real charge deviates from the quoted rate by this much. */
export const FX_DRIFT_THRESHOLD = 0.01

type Charge = Pick<Expense, 'linkedSubscriptionId' | 'date' | 'refundKind' | 'amount' | 'currency' | 'amountInBaseCurrency'>

/** The most recent real (non-refunded) charge recorded against a subscription. */
export function lastCharge<T extends Charge>(subId: string, expenses: T[]): T | null {
  let best: T | null = null
  for (const e of expenses) {
    if (e.linkedSubscriptionId !== subId || e.refundKind) continue
    if (!best || e.date > best.date) best = e
  }
  return best
}

export interface PriceChange {
  from: number
  to: number
  /** Signed percent, one decimal (10.5 = +10.5%). */
  pct: number
}

/**
 * The last real charge vs the plan price. Only compares charges billed in the plan's own
 * currency (a USD plan charged in EGP differs by FX, not by price) and stays quiet while a
 * detected plan change is pending, since that prompt already explains the new amount.
 */
export function priceChange(
  sub: Pick<Subscription, 'id' | 'amount' | 'myShare' | 'currency' | 'pendingPlanId'>,
  expenses: Charge[]
): PriceChange | null {
  if (sub.pendingPlanId) return null
  const last = lastCharge(sub.id, expenses)
  const plan = chargeAmount(sub)
  if (!last || last.currency !== sub.currency || plan <= 0) return null
  const diff = (last.amount - plan) / plan
  if (Math.abs(diff) <= PRICE_CHANGE_THRESHOLD) return null
  return { from: plan, to: last.amount, pct: Math.round(diff * 1000) / 10 }
}

export interface FxEstimate {
  /** What one charge costs in the base currency. */
  estimate: number
  /** Base currency per 1 unit of the plan currency actually used. */
  rate: number
  /** True once a real base-currency charge replaced the quoted rate. */
  refined: boolean
  /** Fractional drift of the real rate against the quoted one (0.02 = +2%). 0 until refined. */
  drift: number
}

/**
 * ≈ cost in the base currency for a plan billed in another currency. Starts at the quoted
 * rate; once a real charge landed in the base currency, that charge's implied rate replaces it.
 */
export function fxEstimate(
  sub: Pick<Subscription, 'id' | 'amount' | 'myShare' | 'currency'>,
  baseCurrency: Currency,
  rates: Record<string, number>,
  expenses: Charge[]
): FxEstimate {
  const amount = chargeAmount(sub)
  const quoted = convertCurrency(1, sub.currency, baseCurrency, rates)
  if (sub.currency === baseCurrency) return { estimate: amount, rate: 1, refined: false, drift: 0 }
  const last = lastCharge(sub.id, expenses)
  if (last && last.currency === baseCurrency && amount > 0 && quoted > 0) {
    const rate = last.amount / amount
    return { estimate: amount * rate, rate, refined: true, drift: rate / quoted - 1 }
  }
  return { estimate: amount * quoted, rate: quoted, refined: false, drift: 0 }
}

/** priceHistory with `amount` appended on `from`; seeds the opening price on the first change. */
export function priceHistoryWith(
  sub: Pick<Subscription, 'amount' | 'startDate' | 'priceHistory'>,
  amount: number,
  from: string
): { amount: number; from: string }[] {
  const history = sub.priceHistory?.length ? sub.priceHistory : [{ amount: sub.amount, from: sub.startDate.slice(0, 10) }]
  return history[history.length - 1]?.amount === amount ? history : [...history, { amount, from }]
}
