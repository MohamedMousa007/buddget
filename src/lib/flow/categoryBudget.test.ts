import { describe, expect, it } from 'vitest'
import { categoryBudget } from '@/lib/flow/categoryBudget'

describe('categoryBudget', () => {
  it('reads the row cap and its spend', () => {
    expect(categoryBudget('Food', { Food: 1000 }, { Food: 250 })).toEqual({ row: 'Food', cap: 1000, spent: 250, left: 750, pct: 0.25 })
  })

  it('goes negative past the cap', () => {
    expect(categoryBudget('Food', { Food: 100 }, { Food: 150 })?.left).toBe(-50)
  })

  it('is null without a positive cap', () => {
    expect(categoryBudget('Food', {}, {})).toBeNull()
    expect(categoryBudget('Food', { Food: 0 }, {})).toBeNull()
  })
})
