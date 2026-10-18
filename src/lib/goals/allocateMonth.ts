import type { Goal } from '@/lib/store/types'

export interface AllocationLine {
  goalId: string
  planned: number
  amount: number
}

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Fill goals in priority order (asc). Shares may total over 100%: higher priority gets its full
 * planned amount first, the rest gets what is left. Unfilled shares are not carried forward.
 * `goals` must already be the ones due this period (monthly, or all on a quarter start).
 */
export function allocateMonth({
  goals,
  periodSavings,
  current,
}: {
  goals: Goal[]
  periodSavings: number
  /** Current saved amount per goal id, to cap at the target. */
  current: Record<string, number>
}): AllocationLine[] {
  let left = Math.max(0, periodSavings)
  return goals
    .filter((g) => g.status === 'active' && g.fundingMode !== 'manual')
    .sort((a, b) => a.priority - b.priority)
    .map((g) => {
      const planned =
        g.fundingMode === 'share'
          ? cents(((periodSavings > 0 ? periodSavings : 0) * (g.sharePct ?? 0)) / 100)
          : cents(g.monthlyContribution ?? 0)
      const toTarget = g.targetAmount === null ? Infinity : Math.max(0, g.targetAmount - (current[g.id] ?? 0))
      const amount = cents(Math.min(planned, left, toTarget))
      left = cents(left - amount)
      return { goalId: g.id, planned, amount }
    })
}
