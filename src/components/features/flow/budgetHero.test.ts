import { describe, expect, it } from 'vitest'
import { budgetHero } from './budgetHero'

describe('budgetHero', () => {
  it('reports the remainder under budget', () => {
    expect(budgetHero(1000, 400)).toEqual({ kind: 'left', amount: 600 })
  })
  it('treats exactly spent as left zero', () => {
    expect(budgetHero(1000, 1000)).toEqual({ kind: 'left', amount: 0 })
  })
  it('reports the overage past budget', () => {
    expect(budgetHero(1000, 1250)).toEqual({ kind: 'over', amount: 250 })
  })
})
