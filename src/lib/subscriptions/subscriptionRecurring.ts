import type { Currency, RecurringExpense, Subscription, SubscriptionBillingCycle } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'

/** Monthly-equivalent amount for planner / recurring row (RecurringExpense is monthly). */
export function subscriptionToMonthlyPlannerAmount(
  amount: number,
  cycle: SubscriptionBillingCycle
): number {
  switch (cycle) {
    case 'monthly':
      return amount
    case 'weekly':
      return amount * (52 / 12)
    case 'quarterly':
      return amount / 3
    case 'yearly':
      return amount / 12
    default:
      return amount
  }
}

function recurringNotes(sub: Subscription): string {
  const base = `Auto-created from subscription: ${sub.name}`
  const cycleNote =
    sub.billingCycle === 'monthly'
      ? ''
      : ` · Cycle: ${sub.billingCycle} (${sub.amount} ${sub.currency} per cycle; monthly planner ≈ ${subscriptionToMonthlyPlannerAmount(sub.amount, sub.billingCycle).toFixed(2)} ${sub.currency})`
  return `${base}${cycleNote}`
}

export function buildRecurringExpenseFromSubscription(
  sub: Subscription,
  recurringId: string,
  fallbackPaymentMethodId: string
): RecurringExpense {
  const pm = sub.paymentMethodId || fallbackPaymentMethodId
  const active = sub.status === 'active' || sub.status === 'trial'
  return {
    id: recurringId,
    description: `${sub.name}${sub.planName ? ` (${sub.planName})` : ''}`,
    category: sub.expenseCategory || 'Enjoyment',
    amount: subscriptionToMonthlyPlannerAmount(sub.amount, sub.billingCycle),
    currency: sub.currency,
    paymentMethodId: pm,
    dayOfMonth: Math.min(31, Math.max(1, sub.billingDay)),
    isActive: active,
    notes: recurringNotes(sub),
    sharedPlanId: null,
  }
}

export function patchRecurringFromSubscription(
  prev: RecurringExpense,
  sub: Subscription,
  fallbackPaymentMethodId: string
): RecurringExpense {
  const built = buildRecurringExpenseFromSubscription(sub, prev.id, fallbackPaymentMethodId)
  return {
    ...built,
    sharedPlanId: prev.sharedPlanId,
    // Rebuilding from scratch would drop the timestamps and null updatedAt, which makes
    // this edit tie-LOSE to the server on the next merge (server > '' is always true).
    // Preserve creation, stamp the edit.
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

/** Live (active + trial) subscriptions as one monthly-equivalent figure in `baseCurrency`. */
export function subscriptionsMonthlyBaseTotal(
  subscriptions: Pick<Subscription, 'status' | 'amount' | 'billingCycle' | 'currency'>[],
  baseCurrency: Currency,
  exchangeRates: Record<string, number>
): number {
  let sum = 0
  for (const sub of subscriptions) {
    if (sub.status !== 'active' && sub.status !== 'trial') continue
    const monthlyEq = subscriptionToMonthlyPlannerAmount(sub.amount, sub.billingCycle)
    sum += convertCurrency(monthlyEq, sub.currency, baseCurrency, exchangeRates)
  }
  return sum
}
