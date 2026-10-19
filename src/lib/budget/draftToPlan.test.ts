import { describe, expect, it } from 'vitest'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import type { PlanDraft } from '@/lib/budget/facts'

describe('draftToCategories', () => {
  it('maps every field and gives each line a fresh id in the plan currency', () => {
    let n = 0
    const draft: PlanDraft = {
      name: 'P', intent: 'balanced', income: 100, free: 0, reasons: [], risks: [],
      lines: [{ block: 'bills', name: 'Rent', icon: 'house', amount: 60, linkType: 'none', linkIds: [], dueDay: 1, essential: true, isSavings: false, expenseCategories: ['Rent'], rationale: 'From your profile', confidence: 'high' }],
    }
    expect(draftToCategories(draft, () => `id${++n}`, 'AED')).toEqual([
      expect.objectContaining({ id: 'id1', currency: 'AED', block: 'bills', dueDay: 1, essential: true, locked: false, subcategories: [], expenseCategories: ['Rent'] }),
    ])
  })
})
