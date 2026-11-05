import { describe, expect, it } from 'vitest'
import { budgetCategoryToRow } from '@/lib/supabase/remote/mappers/budgetPlanMapper'
import type { BudgetPlanCategory } from '@/lib/store/types'

const row = (over: Partial<BudgetPlanCategory>): BudgetPlanCategory => ({
  id: 'c', name: 'Rent', icon: 'house', amount: 1, subcategories: [], ...over,
})

describe('budgetCategoryToRow is_savings', () => {
  it('persists an explicit false on a grow line', () => {
    expect(budgetCategoryToRow(row({ name: 'Giving', block: 'grow', isSavings: false }), 'p', 'u', 0, 'EGP').is_savings).toBe(false)
  })
  it('keeps the name-based savings fallback across a sync round trip', () => {
    expect(budgetCategoryToRow(row({ name: 'Savings' }), 'p', 'u', 0, 'EGP').is_savings).toBe(true)
  })
  it('respects an explicit flag either way', () => {
    expect(budgetCategoryToRow(row({ name: 'Rent', isSavings: true }), 'p', 'u', 0, 'EGP').is_savings).toBe(true)
    expect(budgetCategoryToRow(row({ name: 'Savings', isSavings: false }), 'p', 'u', 0, 'EGP').is_savings).toBe(false)
  })
})

describe('budget plan v2 fields round trip through the production write path', () => {
  it('survives plan -> rows -> plan', async () => {
    const { budgetPlanToRow, assembleBudgetPlan } = await import('@/lib/supabase/remote/mappers/budgetPlanMapper')
    const line: BudgetPlanCategory = row({
      id: 'c1', name: 'Rent', amount: 4800, currency: 'AED', block: 'bills', linkType: 'none', linkIds: [],
      dueDay: 1, essential: true, locked: true, rationale: 'From your profile', confidence: 'high', expenseCategories: ['Rent'],
    })
    const debtLine: BudgetPlanCategory = row({ id: 'c2', name: 'Debt minimums', block: 'debts', linkType: 'debts', linkIds: ['7c1d9a52-3e0b-4f6a-8d27-5b9e1a4c6f03'] })
    const plan = {
      id: 'p', name: 'October plan', categories: [line, debtLine], createdAt: '2026-10-01T00:00:00Z',
      status: 'ready' as const, intent: 'balanced' as const, origin: 'ai' as const, incomeOverride: 18500,
      rationale: { reasons: ['10% to safety'] }, engineVersion: 'v1',
    }
    const planRow = budgetPlanToRow(plan, 'u')
    const catRows = plan.categories.map((c, i) => budgetCategoryToRow(c, 'p', 'u', i, 'AED'))
    const stamp = { created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', deleted_at: null }
    const back = assembleBudgetPlan({
      plan: { ...planRow, ...stamp, household: null, buddgy_flow: null, buddgy_guided_complete: false } as never,
      categories: catRows.map((r) => ({ ...r, ...stamp })) as never,
      subcategories: [],
    })
    expect(back).toMatchObject({ status: 'ready', intent: 'balanced', origin: 'ai', incomeOverride: 18500, engineVersion: 'v1', rationale: { reasons: ['10% to safety'] } })
    expect(back.categories[0]).toMatchObject({ block: 'bills', dueDay: 1, essential: true, locked: true, rationale: 'From your profile', confidence: 'high', expenseCategories: ['Rent'] })
    expect(back.categories[1]).toMatchObject({ block: 'debts', linkType: 'debts', linkIds: ['7c1d9a52-3e0b-4f6a-8d27-5b9e1a4c6f03'] })
  })
})

describe('budgetCategoryToRow link_ids', () => {
  it('drops ids of builder-answered facts: the column is uuid[] and a bad id fails the whole upsert', () => {
    const real = '0b9f2c1e-5d34-4a8e-9f10-2a6d3c7b8e41'
    const out = budgetCategoryToRow(row({ linkType: 'debts', linkIds: ['answered-car', real] }), 'p', 'u', 0, 'EGP')
    expect(out.link_ids).toEqual([real])
  })
})
