import type { SavingsAccount, Currency, SavingsAccountCategory, SavingsType } from '@/lib/store/types'
import type { SavingsAccountRow, SavingsAccountInsert } from '@/lib/supabase/remote/types'

function toDbSavingsType(t: SavingsType): SavingsAccountInsert['type'] {
  // DB enum: bank | cash | gold | crypto | stock | bond | real_estate | other | stablecoin
  // Domain type: bank | cash | gold | stablecoin | crypto | stocks | real_estate | other
  if (t === 'stocks') return 'stock'
  return t as SavingsAccountInsert['type']
}

function fromDbSavingsType(t: SavingsAccountRow['type']): SavingsType {
  if (t === 'stock') return 'stocks'
  if (t === 'bond') return 'other'
  return t as SavingsType
}

interface PocketMeta {
  institution?: string
  accountLast4?: string
  maturityDate?: string
  yearlyReturn?: number
}

export function savingsAccountToRow(a: SavingsAccount, userId: string): SavingsAccountInsert {
  const metadata: PocketMeta = {}
  if (a.institution) metadata.institution = a.institution
  if (a.accountLast4) metadata.accountLast4 = a.accountLast4
  if (a.maturityDate) metadata.maturityDate = a.maturityDate
  if (a.yearlyReturn != null) metadata.yearlyReturn = a.yearlyReturn

  return {
    id: a.id,
    user_id: userId,
    name: a.name,
    category: a.category,
    type: toDbSavingsType(a.type),
    icon: a.icon ?? null,
    currency: a.currency,
    opening_balance: 0, // we don't track this in the Zustand shape — only currentBalance.
    current_balance: a.currentBalance,
    notes: a.notes ?? null,
    color: a.color ?? null,
    is_emergency_cover: a.isEmergencyCover ?? false,
    linked_payment_method_id: a.linkedPaymentMethodId ?? null,
    metadata: metadata as SavingsAccountInsert['metadata'],
    created_at: a.createdAt,
  }
}

export function savingsAccountFromRow(row: SavingsAccountRow): SavingsAccount {
  const meta = (row.metadata ?? {}) as PocketMeta
  return {
    id: row.id,
    name: row.name,
    category: row.category as SavingsAccountCategory,
    type: fromDbSavingsType(row.type),
    icon: row.icon ?? undefined,
    currency: row.currency as Currency,
    currentBalance: row.current_balance,
    notes: row.notes ?? undefined,
    color: row.color ?? undefined,
    isEmergencyCover: row.is_emergency_cover ?? undefined,
    linkedPaymentMethodId: row.linked_payment_method_id ?? undefined,
    institution: meta.institution,
    accountLast4: meta.accountLast4,
    maturityDate: meta.maturityDate,
    yearlyReturn: meta.yearlyReturn,
    createdAt: row.created_at,
  }
}
