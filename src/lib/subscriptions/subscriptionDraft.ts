import { parseISO } from 'date-fns'
import type { Currency, Subscription, SubscriptionBillingCycle, SubscriptionTracking } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { priceHistoryWith } from './subscriptionPricing'
import { subscriptionToMonthlyPlannerAmount, subscriptionsMonthlyBaseTotal } from './subscriptionRecurring'

/** What the add / edit sheet collects, before it becomes a {@link Subscription}. */
export interface SubscriptionDraft {
  name: string
  brandKey: string | null
  planId: string | null
  planName: string | null
  /** Catalog region the chosen plan was priced against; null for a custom service or untouched plan. */
  planRegion: string | null
  amount: number
  currency: Currency
  cycle: SubscriptionBillingCycle
  /** `yyyy-MM-dd`. During a trial this is the day the trial ends: the first paid charge. */
  firstCharge: string
  paymentMethodId: string | null
  tracking: SubscriptionTracking
  reminder: boolean
  trial: boolean
  sharedWith: string[]
  myShare: number | null
  category: string
  notes: string
}

export type SubscriptionPayload = Omit<Subscription, 'id' | 'createdAt' | 'cancelledAt' | 'linkedRecurringExpenseId'>

/**
 * The subscription to store. Editing keeps what the sheet does not own (status, pause and
 * cancel dates) and records a changed price in the history. A pending plan change survives
 * an edit that leaves the plan and price alone: only changing either answers it.
 */
export function draftToSubscription(
  d: SubscriptionDraft,
  editing: Subscription | null,
  today: string
): SubscriptionPayload {
  const trial = d.trial
  const shared = d.sharedWith.length > 0
  const planId = d.brandKey ? d.planId : null
  const resolvesPending = !editing || editing.planId !== planId || editing.amount !== d.amount
  const start = d.firstCharge
  const priceHistory =
    editing && editing.amount !== d.amount ? priceHistoryWith(editing, d.amount, today) : (editing?.priceHistory ?? [])
  return {
    name: d.name.trim(),
    brandKey: d.brandKey,
    planName: d.planName?.trim() || null,
    planId,
    catalogRegion: d.brandKey ? d.planRegion : null,
    pendingPlanId: resolvesPending ? null : editing.pendingPlanId,
    pendingAmount: resolvesPending ? null : editing.pendingAmount,
    pendingPlanFrom: resolvesPending ? null : (editing.pendingPlanFrom ?? null),
    amount: d.amount,
    currency: d.currency,
    billingCycle: d.cycle,
    billingDay: parseISO(start).getDate(),
    startDate: start,
    nextBillingDate: null,
    paymentMethodId: d.paymentMethodId,
    expenseCategory: d.category || 'Enjoyment',
    status: trial ? 'trial' : editing && editing.status !== 'trial' ? editing.status : 'active',
    notes: d.notes.trim() || null,
    tracking: d.tracking,
    reminder: d.reminder,
    trialEnd: trial ? start : null,
    endsOn: editing?.endsOn ?? null,
    pausedAt: editing?.pausedAt ?? null,
    priceHistory,
    sharedWith: shared ? d.sharedWith : null,
    myShare: shared ? d.myShare : null,
  }
}

export interface CommittedImpact {
  /** What this subscription adds to Committed per month (0 during a trial: it is not charged yet). */
  monthly: number
  /** Committed after saving. */
  after: number
}

/** The footer's "+EGP 1,069 / month · Committed becomes 3,269". Editing replaces the old monthly figure. */
export function committedImpact(
  d: Pick<SubscriptionDraft, 'amount' | 'myShare' | 'sharedWith' | 'cycle' | 'currency' | 'trial'>,
  existing: Subscription[],
  editingId: string | null,
  base: Currency,
  rates: Record<string, number>
): CommittedImpact {
  const others = existing.filter((s) => s.id !== editingId)
  const current = subscriptionsMonthlyBaseTotal(others, base, rates)
  const share = d.sharedWith.length > 0 && d.myShare != null ? d.myShare : d.amount
  const monthly = d.trial
    ? 0
    : convertCurrency(subscriptionToMonthlyPlannerAmount(share, d.cycle), d.currency, base, rates)
  return { monthly, after: current + monthly }
}
