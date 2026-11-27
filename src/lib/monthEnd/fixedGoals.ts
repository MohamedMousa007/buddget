import type { Goal } from '@/lib/store/types'

type Split = readonly { target_id: string; pct: number }[] | undefined

/**
 * OQ-2: once the split gives a goal a %, its old fixed monthly amount (`monthly_contribution`) is no longer read: the
 * goal plans as a share of what is left at month end. For read-only figures only (never written back).
 */
export function withSplitShares(goals: readonly Goal[], split: Split): Goal[] {
  const pct = new Map((split ?? []).map((e) => [e.target_id, e.pct]))
  return goals.map((g) => (pct.has(g.id) ? { ...g, fundingMode: 'share' as const, sharePct: pct.get(g.id)!, monthlyContribution: null } : g))
}

/** OQ-2: active fixed-amount goals the split has no line for: the split screen notes each until a % is added or it is dismissed. */
export function fixedGoalNotes(goals: readonly Goal[], split: Split, dismissed: readonly string[] = []): Goal[] {
  const inSplit = new Set((split ?? []).map((e) => e.target_id))
  return goals.filter((g) => g.status === 'active' && g.fundingMode === 'fixed' && (g.monthlyContribution ?? 0) > 0 && !inSplit.has(g.id) && !dismissed.includes(g.id))
}
