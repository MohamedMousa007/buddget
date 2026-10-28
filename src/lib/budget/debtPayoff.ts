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
  /** Minimums of debts cleared in earlier months, free to roll in full. */
  let rolled = 0

  for (let month = 0; month < MAX_MONTHS; month++) {
    // A debt cleared this month frees only what its last payment did not use; its full minimum rolls from next month.
    let freed = 0
    let spare = 0
    for (const d of open) {
      if (d.balance <= 0) continue
      const paid = Math.min(d.minimum, d.balance)
      d.balance -= paid
      if (d.balance <= 0.005) {
        d.balance = 0
        freed += d.minimum
        spare += d.minimum - paid
      }
    }
    let pool = extra + rolled + spare
    for (const d of order) {
      if (pool <= 0) break
      if (d.balance <= 0) continue
      const pay = Math.min(pool, d.balance)
      d.balance -= pay
      pool -= pay
      if (d.balance <= 0.005) {
        d.balance = 0
        freed += d.minimum
      }
    }
    rolled += freed
    if (open.every((d) => d.balance <= 0)) {
      return shiftMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, month)
    }
  }
  return null
}
