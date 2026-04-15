import type { Expense, Currency, ExpenseCategory } from '@/lib/store/types'
import type { ExpenseRow, ExpenseInsert } from '@/lib/supabase/remote/types'

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

function toDbCategory(category: string): ExpenseInsert['category'] {
  return (VALID_CATEGORIES as readonly string[]).includes(category)
    ? (category as ExpenseInsert['category'])
    : 'Other'
}

export function expenseToRow(e: Expense, userId: string): ExpenseInsert {
  return {
    id: e.id,
    user_id: userId,
    description: e.description ?? null,
    category: toDbCategory(e.category),
    amount: e.amount,
    currency: e.currency,
    expense_date: e.date,
    payment_method_id: e.paymentMethodId || null,
    linked_subscription_id: null,
    linked_debt_payment_id: null,
    is_debt_payment: !!e.isDebtPayment,
    notes: e.notes ?? null,
    created_at: e.createdAt,
  }
}

export function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.expense_date,
    description: row.description ?? '',
    category: row.category as string,
    amount: row.amount,
    currency: row.currency as Currency,
    amountInBaseCurrency: row.amount, // Recomputed client-side via FX rates on hydrate if needed.
    paymentMethodId: row.payment_method_id ?? '',
    isRecurring: false,
    notes: row.notes ?? undefined,
    isDebtPayment: row.is_debt_payment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
