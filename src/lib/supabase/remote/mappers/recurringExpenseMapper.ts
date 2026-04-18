import type { RecurringExpense, Currency, ExpenseCategory } from '@/lib/store/types'
import type { RecurringExpenseRow, RecurringExpenseInsert } from '@/lib/supabase/remote/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'

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

function toDbCategory(category: string): RecurringExpenseInsert['category'] {
  return (VALID_CATEGORIES as readonly string[]).includes(category)
    ? (category as RecurringExpenseInsert['category'])
    : 'Other'
}

export function recurringExpenseToRow(
  r: RecurringExpense,
  userId: string
): RecurringExpenseInsert {
  return {
    id: r.id,
    user_id: userId,
    description: r.description,
    category: toDbCategory(r.category),
    amount: r.amount,
    currency: r.currency,
    frequency: 'monthly',
    day_of_month: r.dayOfMonth,
    next_due_date: null,
    is_active: r.isActive,
    payment_method_id:
      r.paymentMethodId && r.paymentMethodId !== DEFAULT_CASH_ID ? r.paymentMethodId : null,
    linked_subscription_id: null,
    notes: r.notes ?? null,
  }
}

export function recurringExpenseFromRow(row: RecurringExpenseRow): RecurringExpense {
  return {
    id: row.id,
    description: row.description ?? '',
    category: row.category as string,
    amount: row.amount,
    currency: row.currency as Currency,
    paymentMethodId: row.payment_method_id ?? '',
    dayOfMonth: row.day_of_month ?? 1,
    isActive: row.is_active,
    notes: row.notes ?? undefined,
  }
}
