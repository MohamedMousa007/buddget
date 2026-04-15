import type {
  BudgetPlan,
  BudgetPlanCategory,
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
    created_at: p.createdAt,
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
    is_savings: !!c.isSavings,
    sort_order: sortOrder,
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
  }))

  return {
    id: plan.id,
    name: plan.name,
    categories: planCategories,
    createdAt: plan.created_at,
    household: (plan.household as BudgetHousehold | null) ?? null,
    buddgyFlow: (plan.buddgy_flow as BudgetPlan['buddgyFlow']) ?? null,
    buddgyGuidedComplete: plan.buddgy_guided_complete ?? false,
  }
}
