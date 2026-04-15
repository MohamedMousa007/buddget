import type { Subscription, Currency, SubscriptionStatus, SubscriptionBillingCycle, ExpenseCategory } from '@/lib/store/types'
import type { SubscriptionRow, SubscriptionInsert } from '@/lib/supabase/remote/types'

const VALID_CATEGORIES: readonly ExpenseCategory[] = [
  'Rent',
  'Transport',
  'Food',
  'Enjoyment',
  'Savings',
  'Debt',
  'Remittance',
  'Other',
]

function toDbCategory(category: string): SubscriptionInsert['expense_category'] {
  return (VALID_CATEGORIES as readonly string[]).includes(category)
    ? (category as SubscriptionInsert['expense_category'])
    : 'Enjoyment'
}

export function subscriptionToRow(s: Subscription, userId: string): SubscriptionInsert {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    brand_key: s.brandKey,
    plan_name: s.planName,
    amount: s.amount,
    currency: s.currency,
    billing_cycle: s.billingCycle,
    billing_day: s.billingDay,
    start_date: s.startDate,
    next_billing_date: s.nextBillingDate,
    payment_method_id: s.paymentMethodId,
    expense_category: toDbCategory(s.expenseCategory),
    linked_recurring_expense_id: s.linkedRecurringExpenseId,
    status: s.status,
    notes: s.notes,
    cancelled_at: s.cancelledAt,
    created_at: s.createdAt,
  }
}

export function subscriptionFromRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    brandKey: row.brand_key,
    planName: row.plan_name,
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
  }
}
