import type { Expense, Currency, ExpenseCategory } from '@/lib/store/types'
import type { ExpenseRow, ExpenseInsert } from '@/lib/supabase/remote/types'
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
  'Groceries',
  'Fuel',
  'Health',
  'Shopping',
  'Education',
  'Utilities',
  'Subscription',
  'ATM Cash Withdrawal',
  'Transfer',
  'Currency Exchange',
  'CC Payoff',
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
    payment_method_id:
      e.paymentMethodId && e.paymentMethodId !== DEFAULT_CASH_ID ? e.paymentMethodId : null,
    linked_subscription_id: e.linkedSubscriptionId ?? null,
    linked_debt_payment_id: e.linkedDebtPaymentId ?? null,
    is_debt_payment: !!e.isDebtPayment,
    notes: e.notes ?? null,
    receipt_id: e.receiptId ?? null,
    sms_log_id: e.smsLogId ?? null,
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
    paymentMethodId: row.payment_method_id ?? DEFAULT_CASH_ID, // null == cash sentinel, stable round-trip
    isRecurring: false,
    notes: row.notes ?? undefined,
    isDebtPayment: row.is_debt_payment,
    linkedSubscriptionId: row.linked_subscription_id ?? undefined,
    linkedDebtPaymentId: row.linked_debt_payment_id ?? undefined,
    smsLogId: row.sms_log_id ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
