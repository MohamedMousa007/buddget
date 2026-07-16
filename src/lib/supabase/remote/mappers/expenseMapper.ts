import type { Expense, Currency } from '@/lib/store/types'
import type { ExpenseRow, ExpenseInsert } from '@/lib/supabase/remote/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { toDbExpenseCategory } from './expenseCategoryCoercion'

function toDbCategory(category: string): ExpenseInsert['category'] {
  return toDbExpenseCategory(category, 'Other')
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
    refunded_at: e.refundedAt ?? null,
    refund_kind: e.refundKind ?? null,
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
    // Mirrors the store's own fallback (`converted ?? expense.amount`) for a row we can't
    // convert without rates. Only ever read by `expenseAmountInBase` when live conversion
    // fails — never sum this field directly, it is the raw foreign amount for hydrated rows.
    amountInBaseCurrency: row.amount,
    paymentMethodId: row.payment_method_id ?? DEFAULT_CASH_ID, // null == cash sentinel, stable round-trip
    isRecurring: false,
    notes: row.notes ?? undefined,
    isDebtPayment: row.is_debt_payment,
    linkedSubscriptionId: row.linked_subscription_id ?? undefined,
    linkedDebtPaymentId: row.linked_debt_payment_id ?? undefined,
    smsLogId: row.sms_log_id ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    refundedAt: row.refunded_at ?? undefined,
    refundKind: (row.refund_kind as 'refunded' | 'declined' | null) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
