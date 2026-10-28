import { describe, expect, it } from 'vitest'
import { createState, applyAnswer } from '@/lib/budget/infoGaps'
import type { BudgetFacts } from '@/lib/budget/facts'
import { incomeKnownRow } from './incomeKnownRow'

const money = (n: number) => `$${n}`
const facts = (monthlyIncome: number) => ({ monthlyIncome }) as BudgetFacts

describe('incomeKnownRow', () => {
  it('lists known income as a row that reopens the confirm question', () => {
    expect(incomeKnownRow(facts(4200), createState(), 'Monthly income', money)).toEqual([
      { id: 'confirmIncome', label: 'Monthly income', value: '$4200' },
    ])
  })
  it('adds nothing when income is unknown', () => {
    expect(incomeKnownRow(facts(0), createState(), 'Monthly income', money)).toEqual([])
  })
  it('leaves it to the income answer row once the user typed an amount', () => {
    expect(incomeKnownRow(facts(4200), applyAnswer(createState(), 'income', 4200), 'Monthly income', money)).toEqual([])
  })
})
