import { describe, expect, it } from 'vitest'
import type { BudgetPlan, BudgetPlanCategory } from '@/lib/store/types'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { capForCategory, categoriesForBudgetKey, otherRowName, planRowNames, resolveBudgetKey, sharedBudgetKey, unassignedSpend } from '@/lib/budget/budgetPlans'
import { categoryFilterIds, orderedCategories } from '@/lib/budget/categoryOrder'

const row = (name: string, amount: number, extra: Partial<BudgetPlanCategory> = {}): BudgetPlanCategory =>
  ({ id: name, name, amount, subcategories: [], ...extra }) as BudgetPlanCategory
const plan = (...cats: BudgetPlanCategory[]): BudgetPlan => ({ id: 'p', name: 'p', categories: cats }) as BudgetPlan

describe('resolveBudgetKey', () => {
  const rows = ['Food', 'Transport', 'Coffee', 'Other']
  it('matches by name case-insensitively', () => {
    expect(resolveBudgetKey('food', rows)).toBe('Food')
    expect(resolveBudgetKey('Coffee', rows)).toBe('Coffee')
  })
  it('folds alias children into their parent row', () => {
    expect(resolveBudgetKey('Groceries', rows)).toBe('Food')
    expect(resolveBudgetKey('Fuel', rows)).toBe('Transport')
    expect(resolveBudgetKey('Health', rows)).toBe('Other')
  })
  it('does not fold an alias that has its own row', () => {
    expect(resolveBudgetKey('Groceries', ['Food', 'Groceries'])).toBe('Groceries')
  })
  it('returns null when nothing covers the category', () => {
    expect(resolveBudgetKey('Instapay', ['Food'])).toBeNull()
    expect(resolveBudgetKey('Groceries', [])).toBeNull()
  })
  it('lists the categories a row filters to', () => {
    expect(categoriesForBudgetKey('Food', ['Food'])).toEqual(['Food', 'Groceries'])
    expect(categoriesForBudgetKey('Food', ['Food', 'Groceries'])).toEqual(['Food'])
    expect(categoriesForBudgetKey('Coffee', ['Coffee'])).toEqual(['Coffee'])
  })
  it('finds a shared key for a set of categories', () => {
    expect(sharedBudgetKey(['Food', 'Groceries'], ['Food'])).toBe('Food')
    expect(sharedBudgetKey(['Food', 'Fuel'], ['Food', 'Transport'])).toBeNull()
    expect(sharedBudgetKey([], ['Food'])).toBeNull()
  })
})

describe('capForCategory', () => {
  it('uses the covering row, none when unassigned or amount 0', () => {
    const caps = { Food: 500, Transport: 0 }
    expect(capForCategory('Groceries', caps)).toBe(500)
    expect(capForCategory('Fuel', caps)).toBeUndefined()
    expect(capForCategory('Instapay', caps)).toBeUndefined()
  })
})

describe('unassignedSpend', () => {
  const spend = { Food: 100, Groceries: 50, Instapay: 70, Transfer: 900, Savings: 10, Debt: 0 }
  it('keeps only spend no row covers, never non-spend categories', () => {
    expect(unassignedSpend(spend, ['Food'])).toEqual({ Instapay: 70 })
  })
  it('folds Health/Education under an Other row', () => {
    expect(unassignedSpend({ Health: 5 }, ['Other'])).toEqual({})
    expect(unassignedSpend({ Health: 5 }, ['Food'])).toEqual({ Health: 5 })
  })
  it('detects the Other row, present or absent', () => {
    expect(otherRowName(['Food', 'other'])).toBe('other')
    expect(otherRowName(['Food'])).toBeNull()
  })
  it('lists plan rows without savings', () => {
    expect(planRowNames(plan(row('Food', 1), row('Savings', 2, { isSavings: true })))).toEqual(['Food'])
  })
})

describe('orderedCategories', () => {
  const none = { caps: {}, rowSpent: {}, spentByCategory: {} }
  it('with no plan lists every default as plain, spent first', () => {
    const out = orderedCategories({ ...none, spentByCategory: { Fuel: 10, Food: 90 } })
    expect(out.every((c) => c.state === 'plain')).toBe(true)
    expect(out.slice(0, 2).map((c) => c.key)).toEqual(['Food', 'Fuel'])
    expect(out.map((c) => c.key)).toEqual(expect.arrayContaining([...EXPENSE_ENTRY_CATEGORIES, 'Instapay']))
    expect(out.map((c) => c.key)).not.toContain('Savings')
  })
  it('puts budgeted first by % used, hides alias children, then unassigned by spend, then defaults', () => {
    const out = orderedCategories({
      caps: { Food: 1000, Transport: 100, Coffee: 50 },
      rowSpent: { Food: 500, Transport: 150, Coffee: 10 },
      spentByCategory: { Groceries: 200, Fuel: 50, Instapay: 80, Debt: 5 },
    })
    const keys = out.map((c) => c.key)
    expect(keys.slice(0, 3)).toEqual(['Transport', 'Food', 'Coffee'])
    expect(out[0]).toMatchObject({ state: 'budgeted', pct: 1.5 })
    expect(out[1].members).toEqual(['Food', 'Groceries'])
    expect(keys).not.toContain('Groceries')
    expect(keys).not.toContain('Fuel')
    expect(keys.slice(3, 5)).toEqual(['Instapay', 'Debt'])
    expect(out[3]).toMatchObject({ state: 'unassigned', pct: null, spent: 80 })
    expect(keys.slice(5)).toEqual(expect.arrayContaining(['Rent', 'Enjoyment', 'Other']))
  })
  it('treats a row with amount 0 as unassigned', () => {
    const out = orderedCategories({ caps: { Food: 0, Rent: 100 }, rowSpent: { Rent: 10 }, spentByCategory: { Food: 30 } })
    expect(out[0].key).toBe('Rent')
    expect(out[1]).toMatchObject({ key: 'Food', state: 'unassigned', spent: 30 })
  })
  it('lists a row with no default name (Coffee) and keeps non-spend out', () => {
    const out = orderedCategories({ caps: { Coffee: 0 }, rowSpent: {}, spentByCategory: { Transfer: 500, Coffee: 20 } })
    expect(out.map((c) => c.key)).toContain('Coffee')
    expect(out.map((c) => c.key)).not.toContain('Transfer')
  })
  it('expands aliases for the filter sheet and appends other seen categories', () => {
    const ordered = orderedCategories({ caps: { Food: 100 }, rowSpent: {}, spentByCategory: {} })
    const ids = categoryFilterIds(ordered, ['Transfer', 'Food'])
    expect(ids.slice(0, 2)).toEqual(['Food', 'Groceries'])
    expect(ids).toContain('Transfer')
    expect(new Set(ids).size).toBe(ids.length)
  })
})
