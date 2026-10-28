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
    category_label: e.category,
    subcategory: e.subcategory ?? null,
    shared_plan_id: e.sharedPlanId ?? null,
    is_recurring: !!e.isRecurring,
    amount: e.amount,
    currency: e.currency,
    expense_date: e.date,
    payment_method_id:
      e.paymentMethodId && e.paymentMethodId !== DEFAULT_CASH_ID ? e.paymentMethodId : null,
    linked_subscription_id: e.linkedSubscriptionId ?? null,
    linked_debt_payment_id: e.linkedDebtPaymentId ?? null,
    linked_debt_id: e.linkedDebtId ?? null,
    is_debt_payment: !!e.isDebtPayment,
    notes: e.notes ?? null,
    receipt_id: e.receiptId ?? null,
    sms_log_id: e.smsLogId ?? null,
    refunded_at: e.refundedAt ?? null,
    refund_kind: e.refundKind ?? null,
    occurred_at: e.occurredAt ?? null,
    spend_exclusion: e.spendExclusion ?? null,
    owed_by: e.owedBy ?? null,
    owed_settled_at: e.owedSettledAt ?? null,
    to_payment_method_id:
      e.toPaymentMethodId && e.toPaymentMethodId !== DEFAULT_CASH_ID ? e.toPaymentMethodId : null,
    created_at: e.createdAt,
  }
}

export function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.expense_date,
    description: row.description ?? '',
    category: row.category_label ?? (row.category as string),
    subcategory: row.subcategory ?? undefined,
    sharedPlanId: row.shared_plan_id ?? undefined,
    amount: row.amount,
    currency: row.currency as Currency,
    // Not stored server-side. 0 = unconverted (same as the store's fail-closed paths); `expenseAmountInBase` converts live when a rate path exists.
    amountInBaseCurrency: 0,
    paymentMethodId: row.payment_method_id ?? DEFAULT_CASH_ID, // null == cash sentinel, stable round-trip
    isRecurring: row.is_recurring,
    notes: row.notes ?? undefined,
    isDebtPayment: row.is_debt_payment,
    linkedSubscriptionId: row.linked_subscription_id ?? undefined,
    linkedDebtPaymentId: row.linked_debt_payment_id ?? undefined,
    linkedDebtId: row.linked_debt_id ?? undefined,
    smsLogId: row.sms_log_id ?? undefined,
    receiptId: row.receipt_id ?? undefined,
    refundedAt: row.refunded_at ?? undefined,
    refundKind: (row.refund_kind as 'refunded' | 'declined' | null) ?? undefined,
    occurredAt: row.occurred_at ?? undefined,
    spendExclusion: (row.spend_exclusion as Expense['spendExclusion'] | null) ?? undefined,
    owedBy: row.owed_by ?? undefined,
    owedSettledAt: row.owed_settled_at ?? undefined,
    toPaymentMethodId: row.to_payment_method_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
