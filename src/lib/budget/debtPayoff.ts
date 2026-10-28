import { shiftMonth } from '@/lib/budget/lineSpend'

export interface PayoffDebt {
  balance: number
  minimum: number
}

const MAX_MONTHS = 600

/**
 * `YYYY-MM` the last debt is cleared when every monthly payment is made and `extra` goes to the smallest balance
 * first; a cleared debt's payment rolls onto the next. Debts are amounts, so nothing grows. Null when there is no
 * debt or no payment ever reaches it.
 */
export function debtFreeMonth(debts: PayoffDebt[], extra: number, now: Date): string | null {
  const open = debts.filter((d) => d.balance > 0.005).map((d) => ({ ...d }))
  if (open.length === 0) return null
  const order = [...open].sort((a, b) => a.balance - b.balance)
  let rolled = 0

  for (let month = 0; month < MAX_MONTHS; month++) {
    for (const d of open) {
      if (d.balance <= 0) continue
      d.balance -= Math.min(d.minimum, d.balance)
      if (d.balance <= 0.005) {
        d.balance = 0
        rolled += d.minimum
      }
    }
    let pool = extra + rolled
    for (const d of order) {
      if (pool <= 0) break
      if (d.balance <= 0) continue
      const pay = Math.min(pool, d.balance)
      d.balance -= pay
      pool -= pay
      if (d.balance <= 0.005) {
        d.balance = 0
        rolled += d.minimum
      }
    }
    if (open.every((d) => d.balance <= 0)) {
      return shiftMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, month)
    }
  }
  return null
}
