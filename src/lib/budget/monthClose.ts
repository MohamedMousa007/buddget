import type { BudgetBlock, CloseMemory } from '@/lib/store/types'
import { monthResult, type MonthResult } from '@/lib/budget/historyResults'
import { isSuppressed } from '@/lib/budget/closeMemory'

/** Blocks whose lines are capped spending; savings and goals are movements, not spend. */
const SPEND_BLOCKS: readonly BudgetBlock[] = ['bills', 'everyday']
const RAISE_AFTER_MONTHS = 2
const LOWER_BELOW_CAP = 0.7
const LOWER_PADDING = 1.1
const MAX_PROPOSALS = 4

export interface CloseLine {
  id: string
  /** `block:name`, how the close memory recognises the line across plans. */
  key?: string
  name: string
  block: BudgetBlock
  cap: number
  spent: number
  /** Three-cycle average spend, null without history. */
  average: number | null
  /** Consecutive cycles, ending with the closing one, that went over the cap. */
  monthsOver: number
  locked: boolean
  linked: boolean
}

export interface CloseProposal {
  lineId: string
  key?: string
  name: string
  kind: 'raise' | 'lower'
  from: number
  to: number
  /** Cycles over the cap (raise) or the average spend (lower), for the reason line. */
  months: number
  average: number
}

export interface CloseSummary {
  planned: number
  spent: number
  result: MonthResult | null
  over: { id: string; name: string; by: number }[]
}

export interface MonthClose {
  summary: CloseSummary
  proposals: CloseProposal[]
}

const spends = (l: CloseLine) => SPEND_BLOCKS.includes(l.block) && l.linked === false && l.cap > 0

/** What a finished cycle says about the plan: the result, the lines that overran, and small fixes to propose. */
export function buildClose(lines: readonly CloseLine[], memory?: { past: CloseMemory | undefined; cycleKey: string }): MonthClose {
  const tracked = lines.filter((l) => SPEND_BLOCKS.includes(l.block) && l.cap > 0)
  const planned = tracked.reduce((s, l) => s + l.cap, 0)
  const spent = tracked.reduce((s, l) => s + l.spent, 0)

  const over = tracked
    .filter((l) => l.spent > l.cap)
    .map((l) => ({ id: l.id, name: l.name, by: Math.round(l.spent - l.cap) }))
    .sort((a, b) => b.by - a.by)
    .slice(0, 3)

  const proposals: (CloseProposal & { weight: number })[] = []
  for (const l of lines) {
    if (!spends(l) || l.locked || l.average === null) continue
    const passed = (kind: 'raise' | 'lower') => !!l.key && !!memory && isSuppressed(memory.past, l.key, kind, memory.cycleKey)
    if (l.monthsOver >= RAISE_AFTER_MONTHS && l.average > l.cap) {
      if (passed('raise')) continue
      const to = Math.round(l.average)
      proposals.push({ lineId: l.id, ...(l.key ? { key: l.key } : {}), name: l.name, kind: 'raise', from: l.cap, to, months: l.monthsOver, average: to, weight: to - l.cap })
    } else if (l.average < l.cap * LOWER_BELOW_CAP && l.spent < l.cap * LOWER_BELOW_CAP) {
      const to = Math.round(l.average * LOWER_PADDING)
      if (to < 1 || passed('lower')) continue
      proposals.push({ lineId: l.id, ...(l.key ? { key: l.key } : {}), name: l.name, kind: 'lower', from: l.cap, to, months: 0, average: Math.round(l.average), weight: l.cap - to })
    }
  }
  proposals.sort((a, b) => b.weight - a.weight)

  return {
    summary: { planned: Math.round(planned), spent: Math.round(spent), result: monthResult(spent, planned), over },
    proposals: proposals.slice(0, MAX_PROPOSALS).map((p) => ({ lineId: p.lineId, ...(p.key ? { key: p.key } : {}), name: p.name, kind: p.kind, from: p.from, to: p.to, months: p.months, average: p.average })),
  }
}
