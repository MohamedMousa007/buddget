import { SAVINGS_TYPE_ICONS } from '@/lib/constants/savingsIcons'
import { defaultCategoryForSavingsType, SAVINGS_TYPES_ORDER } from '@/lib/constants/savingsTypes'
import type { Currency, SavingsAccount, SavingsAccountCategory, SavingsType } from '@/lib/store/types'

function isSavingsType(x: unknown): x is SavingsType {
  return typeof x === 'string' && (SAVINGS_TYPES_ORDER as readonly string[]).includes(x)
}

function coerceType(raw: unknown): SavingsType {
  if (raw === 'crypto_stable') return 'stablecoin'
  if (isSavingsType(raw)) return raw
  return 'other'
}

function coerceCategory(type: SavingsType, raw: unknown): SavingsAccountCategory {
  if (raw === 'savings' || raw === 'investment') return raw
  return defaultCategoryForSavingsType(type)
}

/**
 * Coerce imported or legacy persisted rows into the current `SavingsAccount` shape. Fields it does not coerce are kept
 * as they are (held-in account, colour, maturity, return...): a restore must not drop them. Only the retired `autoSave`
 * is removed.
 */
export function normalizeSavingsAccountRow(row: unknown): SavingsAccount {
  const { autoSave: _retired, ...a } = row as Partial<SavingsAccount> & { emoji?: string; autoSave?: unknown }
  void _retired
  const type = coerceType(a.type)
  const category = coerceCategory(type, a.category)
  const icon =
    typeof a.icon === 'string' && a.icon.trim() ? a.icon.trim() : SAVINGS_TYPE_ICONS[type]

  return {
    ...a,
    id: String(a.id ?? ''),
    name: String(a.name ?? 'Savings'),
    category,
    type,
    icon,
    ...(a.emoji ? { emoji: a.emoji } : {}),
    ...(a.goalId ? { goalId: a.goalId } : {}),
    ...(a.isMonthlySavings ? { isMonthlySavings: true } : {}),
    currency: (a.currency as Currency) ?? 'USD',
    currentBalance: Number(a.currentBalance) || 0,
    ...(a.karat ? { karat: a.karat } : {}),
    createdAt: String(a.createdAt ?? new Date().toISOString()),
    ...(a.notes ? { notes: a.notes } : {}),
  }
}

export function normalizeSavingsAccountsList(rows: unknown[]): SavingsAccount[] {
  return rows.map(normalizeSavingsAccountRow)
}
