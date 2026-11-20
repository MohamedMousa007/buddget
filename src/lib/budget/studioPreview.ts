import { buildPlan } from '@/lib/budget/engine'
import type { BudgetFacts, PlanDraft } from '@/lib/budget/facts'
import { buildFactsFromStore, type FactsSlice } from '@/lib/budget/factsFromStore'
import { applyAnswers } from '@/lib/budget/flow/toFacts'
import type { FlowIntent, FlowValue } from '@/lib/budget/flow/types'
import { repairDraft } from '@/lib/budget/validate'

/**
 * The facts a build plans from: the store's facts, less the records this run created, with remembered answers and this run's
 * answers laid over them once (so a partner share is never applied twice). The builder and the Buddgy chat both call this.
 */
export function studioFacts(live: FactsSlice, answers: Record<string, FlowValue>, intent: FlowIntent, made: ReadonlySet<string> = new Set(), now = new Date()): BudgetFacts {
  const fresh = buildFactsFromStore(live, now, { remembered: false })
  const all = { ...live.profile.financialProfile?.budgetProfile, ...answers }
  return applyAnswers({ ...fresh, debts: fresh.debts.filter((d) => !made.has(d.id)), goals: fresh.goals.filter((g) => !made.has(g.id)) }, all, intent)
}

/** What the validator checks a draft against. */
export const draftContext = (merged: BudgetFacts, d: PlanDraft) => ({
  income: d.income,
  subscriptionsLive: merged.subscriptionsMonthly,
  debtMinimums: Object.fromEntries(merged.debts.map((x) => [x.id, x.minimum])),
  goalMonthly: Object.fromEntries(merged.goals.map((g) => [g.id, g.monthly])),
})

/** The engine's plan, repaired, before any model call: the numbers the AI refinement starts from. */
export function engineDraft(merged: BudgetFacts): PlanDraft {
  const engine = buildPlan(merged)
  return repairDraft(engine, draftContext(merged, engine)).draft
}
