import type {
  BudgetBlock,
  BudgetLineConfidence,
  BudgetLinkType,
  BudgetPlan,
  BudgetPlanCategory,
  BudgetPlanIntent,
  BudgetPlanOrigin,
  BudgetPlanRationale,
  BudgetPlanStatus,
  BudgetPlanSubcategory,
  BudgetHousehold,
  Currency,
} from '@/lib/store/types'
import type {
  BudgetPlanRow,
  BudgetPlanInsert,
  BudgetCategoryRow,
  BudgetCategoryInsert,
  BudgetSubcategoryRow,
  BudgetSubcategoryInsert,
} from '@/lib/supabase/remote/types'
import type { Json } from '@/lib/supabase/database.types'
import { isSavingsPlanCategory } from '@/lib/budget/budgetPlans'

/**
 * A BudgetPlan is stored across 3 tables. These mappers convert one plan at a time;
 * the orchestrator in `sync.ts` handles lifting nested arrays out into table-level writes.
 */

export function budgetPlanToRow(p: BudgetPlan, userId: string): BudgetPlanInsert {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    household: p.household ?? null,
    buddgy_flow: (p.buddgyFlow ?? null) as Json,
    buddgy_guided_complete: !!p.buddgyGuidedComplete,
    status: p.status ?? 'ready',
    intent: p.intent ?? 'custom',
    origin: p.origin ?? 'manual',
    income_override: p.incomeOverride ?? null,
    rationale: (p.rationale ?? null) as Json,
    engine_version: p.engineVersion ?? null,
    created_at: p.createdAt,
    ...(p.updatedAt ? { updated_at: p.updatedAt } : {}),
  }
}

export function budgetCategoryToRow(
  c: BudgetPlanCategory,
  planId: string,
  userId: string,
  sortOrder: number,
  baseCurrency: Currency
): BudgetCategoryInsert {
  return {
    id: c.id,
    user_id: userId,
    plan_id: planId,
    name: c.name,
    icon: c.icon,
    amount: c.amount,
    currency: c.currency ?? baseCurrency,
    is_savings: isSavingsPlanCategory(c),
    sort_order: sortOrder,
    block: c.block ?? 'everyday',
    link_type: c.linkType ?? 'none',
    link_ids: c.linkIds ?? [],
    due_day: c.dueDay ?? null,
    essential: c.essential ?? false,
    locked: c.locked ?? false,
    rationale: c.rationale ?? null,
    confidence: c.confidence ?? null,
    expense_categories: c.expenseCategories ?? [],
  }
}

export function budgetSubcategoryToRow(
  s: BudgetPlanSubcategory,
  categoryId: string,
  userId: string,
  sortOrder: number
): BudgetSubcategoryInsert {
  return {
    id: s.id,
    user_id: userId,
    category_id: categoryId,
    name: s.name,
    icon: s.icon ?? '📦',
    amount: s.amount,
    sort_order: sortOrder,
  }
}

export interface AssemblePlanInput {
  plan: BudgetPlanRow
  categories: BudgetCategoryRow[]
  subcategories: BudgetSubcategoryRow[]
}

export function assembleBudgetPlan({ plan, categories, subcategories }: AssemblePlanInput): BudgetPlan {
  const subsByCategory = new Map<string, BudgetPlanSubcategory[]>()
  const sortedSubs = [...subcategories].sort((a, b) => a.sort_order - b.sort_order)
  for (const sc of sortedSubs) {
    const domain: BudgetPlanSubcategory = {
      id: sc.id,
      name: sc.name,
      icon: sc.icon,
      amount: sc.amount,
    }
    const list = subsByCategory.get(sc.category_id) ?? []
    list.push(domain)
    subsByCategory.set(sc.category_id, list)
  }

  const sortedCats = [...categories]
    .filter((c) => c.plan_id === plan.id)
    .sort((a, b) => a.sort_order - b.sort_order)
  const planCategories: BudgetPlanCategory[] = sortedCats.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    amount: c.amount,
    currency: c.currency as Currency,
    isSavings: c.is_savings,
    subcategories: subsByCategory.get(c.id) ?? [],
    block: c.block as BudgetBlock,
    linkType: c.link_type as BudgetLinkType,
    linkIds: c.link_ids,
    dueDay: c.due_day,
    essential: c.essential,
    locked: c.locked,
    rationale: c.rationale,
    confidence: c.confidence as BudgetLineConfidence | null,
    expenseCategories: c.expense_categories,
  }))

  return {
    id: plan.id,
    name: plan.name,
    categories: planCategories,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    household: (plan.household as BudgetHousehold | null) ?? null,
    buddgyFlow: (plan.buddgy_flow as BudgetPlan['buddgyFlow']) ?? null,
    buddgyGuidedComplete: plan.buddgy_guided_complete ?? false,
    status: plan.status as BudgetPlanStatus,
    intent: plan.intent as BudgetPlanIntent,
    origin: plan.origin as BudgetPlanOrigin,
    incomeOverride: plan.income_override,
    rationale: (plan.rationale as BudgetPlanRationale | null) ?? null,
    engineVersion: plan.engine_version,
  }
}
