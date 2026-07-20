import type { DebtPayment, Currency } from '@/lib/store/types'
import type { DebtPaymentRow, DebtPaymentInsert } from '@/lib/supabase/remote/types'

export function debtPaymentToRow(p: DebtPayment, userId: string): DebtPaymentInsert {
  return {
    id: p.id,
    user_id: userId,
    debt_id: p.debtId,
    payment_method_id: p.paymentMethodId ?? null,
    amount: p.amountPaid,
    currency: (p.paymentCurrency as Currency) ?? 'AED',
    payment_date: p.date,
    notes: p.notes ?? null,
    created_at: p.createdAt,
  }
}

export function debtPaymentFromRow(row: DebtPaymentRow): DebtPayment {
  return {
    id: row.id,
    debtId: row.debt_id,
    date: row.payment_date,
    amountPaid: row.amount,
    paymentMethodId: row.payment_method_id ?? undefined,
    paymentCurrency: row.currency,
    // ponytail: cross-currency FX metadata (original/base/rate) not persisted — the
    // debt_payments row carries one amount+currency. Add columns if mixed-currency
    // payoff history proves lossy in practice.
    originalAmount: row.amount,
    amountInPrimary: row.amount,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}
