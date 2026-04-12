import type { BudgetCategoryRow } from '@/lib/budget/lifestyleMappings'

/** These plan rows keep their base amounts; flexible rows scale with savings slider. */
export const BUDDGY_FIXED_EXPENSE_NAMES = new Set(['Rent', 'Utilities', 'Phone & Internet'])

export function isBuddgyFixedExpenseName(name: string): boolean {
  return BUDDGY_FIXED_EXPENSE_NAMES.has(name.trim())
}

/**
 * Keep fixed categories constant; split `income - fixedSum - savingsAmount` across flexible rows
 * proportionally to their weights (typically the lifestyle-computed amounts).
 */
export function redistributeFlexibleExpenseRows(
  baseExpenseRows: BudgetCategoryRow[],
  income: number,
  savingsAmount: number
): { rows: BudgetCategoryRow[]; savingsAmount: number; totalExpenses: number } {
  const fixed = baseExpenseRows.filter((r) => isBuddgyFixedExpenseName(r.name))
  const flex = baseExpenseRows.filter((r) => !isBuddgyFixedExpenseName(r.name))
  const fixedSum = fixed.reduce((s, r) => s + r.amount, 0)
  const weightSum = flex.reduce((s, r) => s + Math.max(0, r.amount), 0)

  let sav = Math.max(0, Math.round(savingsAmount))
  const maxSav = Math.max(0, income - fixedSum)
  if (sav > maxSav) sav = maxSav

  let flexiblePool = income - fixedSum - sav
  if (flexiblePool < 0) {
    flexiblePool = 0
    sav = Math.max(0, income - fixedSum)
  }

  const nextFlex: BudgetCategoryRow[] =
    weightSum > 0.0001 ?
      flex.map((r) => {
        const w = Math.max(0, r.amount)
        return { ...r, amount: Math.round((flexiblePool * w) / weightSum) }
      })
    : flex.map((r) => ({ ...r, amount: 0 }))

  const flexAmountByName = new Map(nextFlex.map((r) => [r.name, r.amount]))
  const rows = baseExpenseRows.map((r) => {
    if (isBuddgyFixedExpenseName(r.name)) return { ...r }
    const amt = flexAmountByName.get(r.name)
    return amt !== undefined ? { ...r, amount: amt } : { ...r, amount: 0 }
  })

  const totalExpenses = rows.reduce((s, r) => s + r.amount, 0)
  return { rows, savingsAmount: sav, totalExpenses }
}

export type RegenerateTweak =
  | 'more_savings'
  | 'better_lifestyle'
  | 'lower_rent'
  | 'less_dining'
  | 'something_else'

/**
 * Adjust base expense rows before redistribution (Buddgy regenerate feedback).
 */
export function applyRegenerateTweak(
  rows: BudgetCategoryRow[],
  tweak: RegenerateTweak,
  customNote: string | null
): { rows: BudgetCategoryRow[]; noteForAi: string | null; rentNote: string | null } {
  const clone = rows.map((r) => ({ ...r }))
  let noteForAi: string | null = null
  let rentNote: string | null = null

  const flexIdx = (name: string) => clone.findIndex((r) => r.name === name)

  if (tweak === 'more_savings') {
    for (const r of clone) {
      if (!isBuddgyFixedExpenseName(r.name)) {
        r.amount = Math.round(r.amount * 0.85)
      }
    }
    noteForAi = 'User wants to save more; discretionary categories were tightened ~15%.'
  }

  if (tweak === 'better_lifestyle') {
    for (const name of ['Dining Out', 'Entertainment', 'Personal Care']) {
      const i = flexIdx(name)
      if (i >= 0) clone[i] = { ...clone[i], amount: Math.round(clone[i].amount * 1.2) }
    }
    noteForAi = 'User wants a richer lifestyle; bumped dining, entertainment, and personal care ~20%.'
  }

  if (tweak === 'lower_rent') {
    rentNote = 'Rent is based on what you entered in the basics step — change it there to update your plan.'
  }

  if (tweak === 'less_dining') {
    const di = flexIdx('Dining Out')
    const gi = flexIdx('Groceries')
    if (di >= 0) {
      const half = Math.round(clone[di].amount * 0.5)
      const freed = clone[di].amount - half
      clone[di] = { ...clone[di], amount: half }
      if (gi >= 0) {
        clone[gi] = { ...clone[gi], amount: clone[gi].amount + freed }
      }
    }
    noteForAi = 'User wants less dining out; dining was halved and the difference shifted to groceries.'
  }

  if (tweak === 'something_else' && customNote?.trim()) {
    noteForAi = customNote.trim()
  }

  return { rows: clone, noteForAi, rentNote }
}
