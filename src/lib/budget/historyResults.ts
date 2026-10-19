export type MonthResult = { kind: 'onPlan' } | { kind: 'kept'; percent: number } | { kind: 'over'; amount: number }

/** How a finished month went against the plan's expense budget. Null when the plan had no budget. */
export function monthResult(spent: number, budget: number): MonthResult | null {
  if (!(budget > 0)) return null
  if (spent > budget) return { kind: 'over', amount: Math.round(spent - budget) }
  const kept = Math.round(((budget - spent) / budget) * 100)
  return kept >= 2 ? { kind: 'kept', percent: kept } : { kind: 'onPlan' }
}

/** Every `YYYY-MM` from `fromKey` to `toKey` inclusive. */
export function monthKeysBetween(fromKey: string, toKey: string): string[] {
  const [fy, fm] = fromKey.split('-').map(Number)
  const [ty, tm] = toKey.split('-').map(Number)
  const out: string[] = []
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((m = 1), y++) : m++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}
