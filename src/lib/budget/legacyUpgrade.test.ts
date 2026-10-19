import { describe, expect, it } from 'vitest'
import type { BudgetPlanCategory } from '@/lib/store/types'
import { classifyLegacyLine, upgradeLegacyLines } from '@/lib/budget/legacyUpgrade'

const row = (name: string, extra: Partial<BudgetPlanCategory> = {}): BudgetPlanCategory => ({
  id: name, name, icon: '🛒', amount: 100, subcategories: [], ...extra,
})

describe('classifyLegacyLine', () => {
  it.each([
    ['Rent', 'bills', true],
    ['Mortgage', 'bills', true],
    ['DEWA', 'bills', true],
    ['Internet', 'bills', true],
    ['School fees', 'bills', true],
    ['Insurance', 'bills', true],
    ['Groceries', 'everyday', false],
    ['Fun', 'everyday', false],
  ] as const)('%s -> %s', (name, block, essential) => {
    expect(classifyLegacyLine(row(name))).toMatchObject({ block, essential })
  })

  it('links subscriptions, debts, goals and emergency', () => {
    expect(classifyLegacyLine(row('Subscriptions'))).toMatchObject({ block: 'subscriptions', linkType: 'subscriptions' })
    expect(classifyLegacyLine(row('Tabby'))).toMatchObject({ block: 'debts', linkType: 'debts', essential: true })
    expect(classifyLegacyLine(row('Credit card'))).toMatchObject({ block: 'debts' })
    expect(classifyLegacyLine(row('Goals'))).toMatchObject({ block: 'goals', linkType: 'goal' })
    expect(classifyLegacyLine(row('Emergency fund'))).toMatchObject({ block: 'safety', linkType: 'emergency' })
  })

  it('sends investing, giving and savings rows to grow', () => {
    for (const n of ['Investments', 'Zakat', 'Charity', 'Donations']) expect(classifyLegacyLine(row(n)).block).toBe('grow')
    expect(classifyLegacyLine(row('Savings', { isSavings: true })).block).toBe('grow')
  })

  it('does not mistake "Current account" for rent', () => {
    expect(classifyLegacyLine(row('Current stuff')).block).toBe('everyday')
  })

  it('keeps the row name and legacy aliases as counted categories', () => {
    expect(classifyLegacyLine(row('Food')).expenseCategories).toEqual(['Food', 'Groceries'])
    expect(classifyLegacyLine(row('Food'), ['Food', 'Groceries']).expenseCategories).toEqual(['Food'])
    expect(classifyLegacyLine(row('Rent')).expenseCategories).toContain('Rent')
    expect(classifyLegacyLine(row('DEWA')).expenseCategories).toEqual(['DEWA', 'Utilities'])
  })
})

describe('upgradeLegacyLines', () => {
  it('keeps ids and amounts, converts emoji and sets the new fields', () => {
    const [rent] = upgradeLegacyLines([row('Rent', { icon: '🏠', amount: 5000 })])
    expect(rent).toMatchObject({ id: 'Rent', amount: 5000, icon: 'house', block: 'bills', linkType: 'none', linkIds: [], essential: true })
  })

  it('never overwrites an existing block', () => {
    const existing = row('Rent', { block: 'everyday', icon: '🏠' })
    const [out] = upgradeLegacyLines([existing])
    expect(out).toBe(existing)
  })

  it('keeps the stored amount on linked rows and leaves link ids empty', () => {
    const [subs, debt] = upgradeLegacyLines([row('Subscriptions', { amount: 240 }), row('Debt', { amount: 900 })])
    expect(subs).toMatchObject({ amount: 240, linkType: 'subscriptions', linkIds: [] })
    expect(debt).toMatchObject({ amount: 900, linkType: 'debts', linkIds: [] })
  })

  it('passes sibling names so a dedicated Groceries row keeps its own spend', () => {
    const out = upgradeLegacyLines([row('Food'), row('Groceries')])
    expect(out[0].expenseCategories).toEqual(['Food'])
    expect(out[1].expenseCategories).toEqual(['Groceries'])
  })

  it('handles an empty list', () => {
    expect(upgradeLegacyLines([])).toEqual([])
  })
})
