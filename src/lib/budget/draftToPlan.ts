import type { BudgetPlanCategory, Currency } from '@/lib/store/types'
import type { PlanDraft } from '@/lib/budget/facts'

/** Turns the engine's or the AI's draft lines into plan lines ready for the store. */
export function draftToCategories(draft: PlanDraft, newId: () => string, currency: Currency): BudgetPlanCategory[] {
  return draft.lines.map((l) => ({
    id: newId(),
    name: l.name,
    icon: l.icon,
    amount: l.amount,
    currency,
    isSavings: l.isSavings,
    subcategories: [],
    block: l.block,
    linkType: l.linkType,
    linkIds: l.linkIds,
    dueDay: l.dueDay,
    essential: l.essential,
    locked: false,
    rationale: l.rationale,
    confidence: l.confidence,
    expenseCategories: l.expenseCategories,
  }))
}
