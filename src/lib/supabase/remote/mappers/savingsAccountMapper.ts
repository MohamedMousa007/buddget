import type { SavingsAccount, Currency, GoldKarat, SavingsAccountCategory, SavingsType } from '@/lib/store/types'
import type { SavingsAccountRow, SavingsAccountInsert } from '@/lib/supabase/remote/types'
import { serverPaymentMethodId } from './serverPaymentMethodId'
import { systemVaultId } from '@/lib/savings/pocketIdentity'

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
  karat?: GoldKarat
}

export function savingsAccountToRow(a: SavingsAccount, userId: string): SavingsAccountInsert {
  const metadata: PocketMeta = {}
  if (a.institution) metadata.institution = a.institution
  if (a.accountLast4) metadata.accountLast4 = a.accountLast4
  if (a.maturityDate) metadata.maturityDate = a.maturityDate
  if (a.yearlyReturn != null) metadata.yearlyReturn = a.yearlyReturn
  if (a.karat != null) metadata.karat = a.karat

  return {
    id: a.id,
    user_id: userId,
    name: a.name,
    category: a.category,
    type: toDbSavingsType(a.type),
    icon: a.icon ?? null,
    emoji: a.emoji ?? null,
    // target_amount is retired (0364): never sent, so the stored value stays until the contract migration.
    // goal_id is sent only when known (null unlinks): a row cached before 0355 must not erase the backfill.
    ...(a.goalId !== undefined ? { goal_id: a.goalId } : {}),
    // Same for the Monthly savings flag; the system vault is always one (0355 backfill rule).
    ...(a.isMonthlySavings !== undefined ? { is_monthly_savings: a.isMonthlySavings } : a.id === systemVaultId(userId) ? { is_monthly_savings: true } : {}),
    currency: a.currency,
    opening_balance: 0, // we don't track this in the Zustand shape — only currentBalance.
    current_balance: a.currentBalance,
    notes: a.notes ?? null,
    color: a.color ?? null,
    is_emergency_cover: a.isEmergencyCover ?? false,
    held_in_payment_method_id: serverPaymentMethodId(a.heldInPaymentMethodId),
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
    emoji: row.emoji ?? undefined,
    goalId: row.goal_id ?? undefined,
    isMonthlySavings: row.is_monthly_savings || undefined,
    currency: row.currency as Currency,
    currentBalance: row.current_balance,
    notes: row.notes ?? undefined,
    color: row.color ?? undefined,
    isEmergencyCover: row.is_emergency_cover ?? undefined,
    heldInPaymentMethodId: row.held_in_payment_method_id ?? undefined,
    institution: meta.institution,
    accountLast4: meta.accountLast4,
    maturityDate: meta.maturityDate,
    yearlyReturn: meta.yearlyReturn,
    ...(meta.karat != null ? { karat: meta.karat } : {}),
    createdAt: row.created_at,
    updatedAt: row.edited_at,
  }
}
