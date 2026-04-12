import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { SAVINGS_TYPES_ORDER } from '@/lib/constants/savingsTypes'
import type { Currency, SavingsAccount, SavingsType } from '@/lib/store/types'

function isSavingsType(x: unknown): x is SavingsType {
  return typeof x === 'string' && (SAVINGS_TYPES_ORDER as readonly string[]).includes(x)
}

/**
 * Coerce imported or legacy persisted rows into the current `SavingsAccount` shape.
 */
export function normalizeSavingsAccountRow(row: unknown): SavingsAccount {
  const a = row as Partial<SavingsAccount> & { emoji?: string }
  const type: SavingsType = isSavingsType(a.type) ? a.type : 'other'
  const icon =
    typeof a.icon === 'string' && a.icon.trim() ? a.icon.trim() : SAVINGS_TYPE_ICONS[type]

  return {
    id: String(a.id ?? ''),
    name: String(a.name ?? 'Savings'),
    type,
    icon,
    ...(a.emoji ? { emoji: a.emoji } : {}),
    ...(a.targetAmount != null && Number.isFinite(a.targetAmount) ? { targetAmount: a.targetAmount } : {}),
    currency: (a.currency as Currency) ?? 'USD',
    currentBalance: Number(a.currentBalance) || 0,
    createdAt: String(a.createdAt ?? new Date().toISOString()),
    ...(a.notes ? { notes: a.notes } : {}),
    ...(a.autoSave ? { autoSave: a.autoSave } : {}),
  }
}

export function normalizeSavingsAccountsList(rows: unknown[]): SavingsAccount[] {
  return rows.map(normalizeSavingsAccountRow)
}
