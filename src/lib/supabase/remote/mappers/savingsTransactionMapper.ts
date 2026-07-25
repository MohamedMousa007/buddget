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
  }
}

export function savingsTransactionFromRow(row: SavingsTransactionRow): SavingsTransaction {
  const normalisedKind: 'deposit' | 'withdrawal' =
    row.kind === 'deposit' || row.kind === 'withdrawal'
      ? row.kind
      : 'deposit'
  return {
    id: row.id,
    accountId: row.account_id,
    type: normalisedKind,
    amount: row.amount,
    currency: row.currency as Currency,
    date: row.transaction_date,
    notes: row.notes ?? undefined,
    isCashFlow: row.is_cash_flow ?? true,
    source: row.source ?? undefined,
    isAutoSave: row.is_auto_save ?? undefined,
    transferGroupId: row.transfer_group_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}
