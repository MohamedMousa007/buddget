import type { BudgetPlan, BudgetPlanActivation } from '@/lib/store/types'
import { isLivePlan, selectActivePlan } from '@/lib/budget/activePlan'

/** `YYYY-MM` of the cycle `date` falls in, for a cycle that starts on `monthStartDay` (clamped to 28). */
export function cycleKeyOf(date: Date, monthStartDay: number): string {
  const start = Math.min(28, Math.max(1, Math.floor(monthStartDay) || 1))
  const shift = date.getDate() >= start ? 0 : -1
  const d = new Date(date.getFullYear(), date.getMonth() + shift, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const keyOf = (a: BudgetPlanActivation) => a.effectiveFrom.slice(0, 7)

/**
 * The plan a month is judged by: the latest activation at or before it. A month before the first
 * activation uses the first plan. An explicitly active plan that the log has not caught up with governs the months after the log. Without any activation (pre-v2 data) the stored active plan applies.
 */
export function planForMonth(
  plans: readonly BudgetPlan[],
  activations: readonly BudgetPlanActivation[],
  monthKey: string,
  activeId: string | null
): BudgetPlan | null {
  const sorted = [...activations].sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
  const byId = new Map(plans.map((p) => [p.id, p]))
  const atOrBefore = sorted.filter((a) => keyOf(a) <= monthKey).reverse()
  // The active plan was chosen without logging a switch: it governs every month the log does not reach.
  const latest = sorted.at(-1)
  const active = plans.find((p) => p.id === activeId)
  if (latest && active && isLivePlan(active) && keyOf(latest) <= monthKey && latest.planId !== active.id) return active
  for (const a of [...atOrBefore, ...sorted]) {
    const plan = byId.get(a.planId)
    if (plan) return plan
  }
  return selectActivePlan(plans, activeId)
}

/**
 * Records that `planId` took over from `cycleKey`. One row per cycle: switching twice in the same
 * cycle replaces the first switch (the last one wins); switching back to the plan already in force adds no row.
 */
export function recordActivation(
  activations: readonly BudgetPlanActivation[],
  planId: string,
  cycleKey: string,
  newId: () => string,
  now: string
): BudgetPlanActivation[] {
  const rest = activations.filter((a) => keyOf(a) !== cycleKey)
  const inForce = [...rest].filter((a) => keyOf(a) < cycleKey).sort((a, b) => keyOf(a).localeCompare(keyOf(b))).at(-1)
  if (inForce?.planId === planId) return rest
  return [...rest, { id: newId(), planId, effectiveFrom: `${cycleKey}-01`, createdAt: now }]
}

export interface PlanSpan {
  plan: BudgetPlan
  /** First cycle (`YYYY-MM`) the plan covered. */
  fromKey: string
  /** Last cycle it covered; null while it is still the active plan. */
  toKey: string | null
}

/** The cycle before `key`. */
export const prevKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The history log: each stretch a plan was active, newest first. Activations of deleted plans are skipped. */
export function planHistory(plans: readonly BudgetPlan[], activations: readonly BudgetPlanActivation[]): PlanSpan[] {
  const byId = new Map(plans.map((p) => [p.id, p]))
  const rows = [...activations].sort((a, b) => keyOf(a).localeCompare(keyOf(b))).filter((a) => byId.has(a.planId))
  return rows
    .map((a, i) => ({
      plan: byId.get(a.planId)!,
      fromKey: keyOf(a),
      toKey: i === rows.length - 1 ? null : prevKey(keyOf(rows[i + 1])),
    }))
    .reverse()
}
