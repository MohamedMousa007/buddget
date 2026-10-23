import type { BudgetBlock, BudgetPlanCategory, Currency } from '@/lib/store/types'
import type { BudgetFacts, DraftLine, PlanDraft } from '@/lib/budget/facts'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { buildPlan } from '@/lib/budget/engine'
import { repairDraft } from '@/lib/budget/validate'

/** Starting points for the manual builder. All run the same engine over the user's own numbers, nudged. */
export type BuildTemplate = 'mine' | 'essentials' | 'debt' | 'saver'

export const BUILD_TEMPLATES: readonly BuildTemplate[] = ['mine', 'essentials', 'debt', 'saver']

const NUDGE: Record<BuildTemplate, Partial<BudgetFacts>> = {
  mine: {},
  essentials: { securityLean: 50, priorities: ['safety'] },
  debt: { securityLean: 60, priorities: ['debt', 'safety'] },
  saver: { securityLean: 15, priorities: ['safety', 'goals', 'invest'], investInterest: true },
}

/** The engine's plan for these facts, repaired against what the app already knows. */
export function templateDraft(facts: BudgetFacts, template: BuildTemplate): PlanDraft {
  const f = { ...facts, ...NUDGE[template] }
  const draft = buildPlan(f)
  return repairDraft(draft, {
    income: draft.income,
    subscriptionsLive: f.subscriptionsMonthly,
    debtMinimums: Object.fromEntries(f.debts.map((d) => [d.id, d.minimum])),
    goalMonthly: Object.fromEntries(f.goals.map((g) => [g.id, g.monthly])),
  }).draft
}

/** What the builder offers per block: the engine's lines for that block, as "found for you" chips. */
export function suggestionsByBlock(draft: PlanDraft): Record<BudgetBlock, DraftLine[]> {
  const out = Object.fromEntries(BUDGET_BLOCKS.map((b) => [b, [] as DraftLine[]])) as Record<BudgetBlock, DraftLine[]>
  for (const l of draft.lines) out[l.block].push(l)
  return out
}

const key = (name: string) => name.trim().toLowerCase()

/** The plan line a suggestion is already added as, if any. Linked lines match on their links, others on name. */
export function findAdded(lines: readonly BudgetPlanCategory[], block: BudgetBlock, s: DraftLine): BudgetPlanCategory | undefined {
  return lines.find((c) => {
    if ((c.block ?? null) !== block) return false
    if (s.linkIds.length > 0) return s.linkIds.some((id) => c.linkIds?.includes(id))
    return key(c.name) === key(s.name)
  })
}

export function suggestionToCategory(s: DraftLine, id: string, currency: Currency): BudgetPlanCategory {
  return {
    id,
    name: s.name,
    icon: s.icon,
    amount: s.amount,
    currency,
    isSavings: s.isSavings,
    subcategories: [],
    block: s.block,
    linkType: s.linkType,
    linkIds: s.linkIds,
    dueDay: s.dueDay,
    essential: s.essential,
    locked: false,
    rationale: s.rationale,
    confidence: s.confidence,
    expenseCategories: s.expenseCategories,
  }
}

/** What the user wants their money to do; picks the starting template and the plan's intent. */
export type CreateIntent = 'save' | 'debt' | 'overspending' | 'goal' | 'organise'

export const CREATE_INTENTS: readonly CreateIntent[] = ['save', 'debt', 'overspending', 'goal', 'organise']

/** Priorities an intent implies, seeded as the studio's priorities answer. Overspending and organise leave it to the user. */
export const INTENT_PRIORITIES: Partial<Record<CreateIntent, string[]>> = {
  save: ['safety', 'invest'],
  debt: ['debt', 'safety'],
  goal: ['goals', 'safety'],
}
