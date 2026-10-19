import type { BudgetBlock } from '@/lib/store/types'

export type StressKind = 'income' | 'bills' | 'everyday'
export interface StressScenario {
  kind: StressKind
  /** Whole percent, 1-100. */
  pct: number
}

export interface StressLine {
  id: string
  name: string
  block: BudgetBlock
  amount: number
  essential: boolean
  locked: boolean
  linked: boolean
}

export interface Trim {
  id: string
  name: string
  from: number
  to: number
}

export interface StressResult {
  income: number
  total: number
  /** Income minus lines after the shock; negative is a deficit. */
  free: number
  trims: Trim[]
  /** Deficit still open after every trim; 0 when the plan can absorb the shock. */
  shortfall: number
}

/** Cut tiers in the order money is given up, each with the floor a line may fall to. */
const TIERS: { match: (l: StressLine) => boolean; floor: number }[] = [
  { match: (l) => l.block === 'grow', floor: 0 },
  { match: (l) => l.block === 'everyday' && !l.essential, floor: 0.5 },
  { match: (l) => l.block === 'everyday' && l.essential, floor: 0.8 },
]

const scale = (l: StressLine, s: StressScenario): number => {
  const hit = (s.kind === 'bills' && l.block === 'bills') || (s.kind === 'everyday' && l.block === 'everyday')
  return hit ? Math.round(l.amount * (1 + s.pct / 100)) : l.amount
}

/** Applies a shock to the plan and finds what could be trimmed, cheapest-to-lose first, to stay within income. */
export function stressPlan(lines: readonly StressLine[], income: number, s: StressScenario): StressResult {
  const shocked = lines.map((l) => ({ ...l, amount: scale(l, s) }))
  const newIncome = s.kind === 'income' ? Math.round(income * (1 - s.pct / 100)) : income
  const total = shocked.reduce((sum, l) => sum + l.amount, 0)
  let deficit = Math.max(0, total - newIncome)

  const trims: Trim[] = []
  for (const tier of TIERS) {
    if (deficit <= 0) break
    const pool = shocked.filter((l) => !l.locked && !l.linked && l.amount > 0 && tier.match(l)).sort((a, b) => b.amount - a.amount)
    for (const l of pool) {
      if (deficit <= 0) break
      const room = l.amount - Math.round(l.amount * tier.floor)
      const cut = Math.min(room, deficit)
      if (cut <= 0) continue
      trims.push({ id: l.id, name: l.name, from: l.amount, to: l.amount - cut })
      deficit -= cut
    }
  }
  return { income: newIncome, total, free: newIncome - total, trims, shortfall: Math.max(0, deficit) }
}
