import type { Expense } from '@/lib/store/types'

export interface WhereItWentRow {
  name: string
  amount: number
}

/**
 * The biggest places the cycle's everyday money went: spend on the plan's everyday lines grouped by what the
 * ledger entry says it was (case and spacing ignored), debt payments and refunds left out. Empty when nothing is named.
 */
export function whereItWent(expenses: readonly Expense[], everydayLineNames: ReadonlySet<string>, start: Date, end: Date, limit = 3): WhereItWentRow[] {
  const totals = new Map<string, WhereItWentRow>()
  for (const e of expenses) {
    if (!everydayLineNames.has(e.category) || e.isDebtPayment || !(e.amountInBaseCurrency > 0)) continue
    const day = new Date(e.date)
    if (day < start || day > end) continue
    const name = e.description.trim().replace(/\s+/g, ' ')
    const key = name.toLowerCase()
    if (!key) continue
    const row = totals.get(key) ?? { name, amount: 0 }
    row.amount += e.amountInBaseCurrency
    totals.set(key, row)
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, limit)
}
