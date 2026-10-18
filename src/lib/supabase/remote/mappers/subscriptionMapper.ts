import type {
  Subscription,
  Currency,
  SubscriptionStatus,
  SubscriptionBillingCycle,
  SubscriptionTracking,
} from '@/lib/store/types'
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/supabase/remote/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { toDbExpenseCategory } from './expenseCategoryCoercion'

/** Falls back to Enjoyment (not Other) — a subscription is discretionary spend by default. */
function toDbCategory(category: string): SubscriptionInsert['expense_category'] {
  return toDbExpenseCategory(category, 'Enjoyment')
}

export function subscriptionToRow(s: Subscription, userId: string): SubscriptionInsert {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    brand_key: s.brandKey,
    plan_name: s.planName,
    plan_id: s.planId,
    catalog_region: s.catalogRegion,
    pending_plan_id: s.pendingPlanId,
    pending_amount: s.pendingAmount,
    amount: s.amount,
    currency: s.currency,
    billing_cycle: s.billingCycle,
    billing_day: s.billingDay,
    start_date: s.startDate,
    next_billing_date: s.nextBillingDate,
    payment_method_id:
      s.paymentMethodId && s.paymentMethodId !== DEFAULT_CASH_ID ? s.paymentMethodId : null,
    expense_category: toDbCategory(s.expenseCategory),
    linked_recurring_expense_id: s.linkedRecurringExpenseId,
    status: s.status,
    notes: s.notes,
    cancelled_at: s.cancelledAt,
    created_at: s.createdAt,
    tracking: s.tracking ?? 'sms',
    reminder: s.reminder ?? true,
    trial_end: s.trialEnd ?? null,
    ends_on: s.endsOn ?? null,
    paused_at: s.pausedAt ?? null,
    price_history: s.priceHistory ?? [],
    pending_plan_from: s.pendingPlanFrom ?? null,
    shared_with: s.sharedWith ?? null,
    my_share: s.myShare ?? null,
  }
}

export function subscriptionFromRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    brandKey: row.brand_key,
    planName: row.plan_name,
    planId: row.plan_id ?? null,
    catalogRegion: row.catalog_region ?? null,
    pendingPlanId: row.pending_plan_id ?? null,
    pendingAmount: row.pending_amount ?? null,
    amount: row.amount,
    currency: row.currency as Currency,
    billingCycle: row.billing_cycle as SubscriptionBillingCycle,
    billingDay: row.billing_day,
    startDate: row.start_date,
    nextBillingDate: row.next_billing_date,
    paymentMethodId: row.payment_method_id,
    expenseCategory: row.expense_category as string,
    linkedRecurringExpenseId: row.linked_recurring_expense_id,
    status: row.status as SubscriptionStatus,
    notes: row.notes,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,
    tracking: row.tracking as SubscriptionTracking,
    reminder: row.reminder,
    trialEnd: row.trial_end,
    endsOn: row.ends_on,
    pausedAt: row.paused_at,
    priceHistory: (row.price_history as { amount: number; from: string }[] | null) ?? [],
    pendingPlanFrom: row.pending_plan_from,
    sharedWith: row.shared_with,
    myShare: row.my_share,
  }
}
