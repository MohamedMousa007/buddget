import type { SavingsTransaction, Currency } from '@/lib/store/types'
import type { SavingsTransactionRow, SavingsTransactionInsert } from '@/lib/supabase/remote/types'

export function savingsTransactionToRow(
  t: SavingsTransaction,
  userId: string
): SavingsTransactionInsert {
  return {
    id: t.id,
    user_id: userId,
    account_id: t.accountId,
    kind: t.type,
    amount: t.amount,
    currency: t.currency,
    balance_after: null,
    transaction_date: t.date,
    notes: t.notes ?? null,
    is_cash_flow: t.isCashFlow ?? true,
    source: t.source ?? null,
    is_auto_save: t.isAutoSave ?? false,
    transfer_group_id: t.transferGroupId ?? null,
    occurred_at: t.occurredAt ?? null,
    payment_method_id: t.paymentMethodId ?? null,
  }
}

export function savingsTransactionFromRow(row: SavingsTransactionRow): SavingsTransaction {
  // Server RPCs write 'withdraw' and 'correct'. A correction moves the balance without cash.
  const normalisedKind: 'deposit' | 'withdrawal' =
    row.kind === 'withdrawal' || row.kind === 'withdraw' ? 'withdrawal' : 'deposit'
  return {
    id: row.id,
    accountId: row.account_id,
    type: normalisedKind,
    amount: row.amount,
    currency: row.currency as Currency,
    date: row.transaction_date,
    notes: row.notes ?? undefined,
    isCashFlow: row.kind === 'correct' ? false : (row.is_cash_flow ?? true),
    source: row.source ?? undefined,
    isAutoSave: row.is_auto_save ?? undefined,
    transferGroupId: row.transfer_group_id ?? undefined,
    occurredAt: row.occurred_at ?? undefined,
    paymentMethodId: row.payment_method_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}
