/**
 * The Savings hero pace pill — deliberately short (§2.1). Compares this month's saved against the
 * user's own trailing average, never a benchmark. Four states only.
 */
export type SavingsPaceState = 'ahead' | 'onpace' | 'behind' | 'none'

export interface SavingsPace {
  state: SavingsPaceState
  /** Signed percent vs the trailing average (0 for 'none'). */
  percent: number
}

export function savingsPace(thisMonthSaved: number, trailingAvgSaved: number): SavingsPace {
  if (thisMonthSaved <= 0) return { state: 'none', percent: 0 }
  const pct =
    trailingAvgSaved > 0
      ? ((thisMonthSaved - trailingAvgSaved) / trailingAvgSaved) * 100
      : 100 // first-ever saving reads as ahead
  if (pct >= 8) return { state: 'ahead', percent: Math.round(pct) }
  if (pct <= -8) return { state: 'behind', percent: Math.round(pct) }
  return { state: 'onpace', percent: Math.round(pct) }
}
