import type { DebtPayment, Currency } from '@/lib/store/types'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import type { DebtPaymentRow, DebtPaymentInsert } from '@/lib/supabase/remote/types'

export function debtPaymentToRow(p: DebtPayment, userId: string): DebtPaymentInsert {
  return {
    id: p.id,
    user_id: userId,
    debt_id: p.debtId,
    payment_method_id: p.paymentMethodId ?? null,
    // Legacy pair: debt units labelled with the paying currency. Old builds read only these.
    amount: p.amountPaid,
    currency: (p.paymentCurrency as Currency) ?? DEFAULT_SETTINGS.baseCurrency,
    amount_in_debt_unit: p.amountPaid,
    original_amount: p.originalAmount ?? null,
    original_currency: (p.paymentCurrency as Currency | undefined) ?? null,
    amount_in_base: p.amountInPrimary ?? null,
    rate_at_entry: p.rateAtEntry ?? null,
    payment_date: p.date,
    notes: p.notes ?? null,
    funded_from_savings: p.fundedFromSavings ?? false,
    funded_from_savings_tx_id: p.fundedFromSavingsTxId ?? null,
    occurred_at: p.occurredAt ?? null,
    created_at: p.createdAt,
  }
}

export function debtPaymentFromRow(row: DebtPaymentRow): DebtPayment {
  return {
    id: row.id,
    debtId: row.debt_id,
    date: row.payment_date,
    amountPaid: row.amount_in_debt_unit ?? row.amount,
    paymentMethodId: row.payment_method_id ?? undefined,
    paymentCurrency: row.original_currency ?? row.currency,
    // NULL stays undefined: legacy gold rows hold grams in `amount`, readers must tell them apart from money.
    originalAmount: row.original_amount ?? undefined,
    amountInPrimary: row.amount_in_base ?? row.amount,
    rateAtEntry: row.rate_at_entry ?? undefined,
    notes: row.notes ?? undefined,
    fundedFromSavings: row.funded_from_savings ?? undefined,
    fundedFromSavingsTxId: row.funded_from_savings_tx_id ?? undefined,
    occurredAt: row.occurred_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}
