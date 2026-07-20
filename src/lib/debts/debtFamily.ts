import type { Debt } from '@/lib/store/types'

/** The three top-level debt families the debt tab is organised into. */
export type DebtFamily = 'borrow' | 'credit_card' | 'installment'

/** Tab order; also the smart-default priority (first non-empty wins). */
export const DEBT_FAMILY_ORDER: DebtFamily[] = ['borrow', 'credit_card', 'installment']

/**
 * Single source of truth for which family a debt belongs to.
 * - credit_card → Credit Card
 * - installment (or a scheduled `general` debt) → Installments
 * - personal / open-lump general → Borrow
 * "Loan" is deliberately absent — the app never uses that (non-compliant) label.
 */
export function debtFamily(debt: Debt): DebtFamily {
  if (debt.debtType === 'credit_card') return 'credit_card'
  if (debt.debtType === 'installment') return 'installment'
  // A `general` debt with a fixed schedule behaves like an installment plan.
  if (debt.debtType === 'general' && (debt.installmentCount ?? 0) > 0) return 'installment'
  return 'borrow'
}

function isActive(d: Debt): boolean {
  return d.status !== 'cleared'
}

/**
 * The tab to land on when opening the debt page: the first family (in
 * DEBT_FAMILY_ORDER) that has at least one active debt; falls back to 'borrow'
 * when everything is empty or fully cleared.
 */
export function firstNonEmptyFamily(debts: Debt[]): DebtFamily {
  const active = debts.filter(isActive)
  for (const family of DEBT_FAMILY_ORDER) {
    if (active.some((d) => debtFamily(d) === family)) return family
  }
  return 'borrow'
}
