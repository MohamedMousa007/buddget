import type { RecurringDebtPayment, Currency, DebtRecurringFrequency } from '@/lib/store/types'
import type { RecurringDebtPaymentRow, RecurringDebtPaymentInsert } from '@/lib/supabase/remote/types'

function toDbFrequency(f: DebtRecurringFrequency): RecurringDebtPaymentInsert['frequency'] {
  // DB enum: weekly | biweekly | monthly | quarterly | annually — all match.
  return f as RecurringDebtPaymentInsert['frequency']
}

export function recurringDebtPaymentToRow(
  r: RecurringDebtPayment,
  userId: string
): RecurringDebtPaymentInsert {
  return {
    id: r.id,
    user_id: userId,
    debt_id: r.debtId,
    payment_method_id: r.paymentMethodId || null,
    amount: r.amount,
    currency: r.currency,
    frequency: toDbFrequency(r.frequency),
    day_of_month: null,
    next_due_date: r.nextDueDate,
    is_active: r.isActive,
    notes: r.notes ?? null,
    created_at: r.createdAt,
  }
}

export function recurringDebtPaymentFromRow(row: RecurringDebtPaymentRow): RecurringDebtPayment {
  return {
    id: row.id,
    debtId: row.debt_id,
    amount: row.amount,
    currency: row.currency as Currency,
    paymentMethodId: row.payment_method_id ?? '',
    frequency: row.frequency as DebtRecurringFrequency,
    nextDueDate: row.next_due_date ?? new Date().toISOString().slice(0, 10),
    isActive: row.is_active,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}
