import { describe, expect, it } from 'vitest'
import { budgetMemoryLines } from '@/lib/budget/memoryLines'

describe('budgetMemoryLines', () => {
  it('is empty for a fresh profile', () => {
    expect(budgetMemoryLines(null)).toEqual([])
    expect(budgetMemoryLines({})).toEqual([])
  })
  it('turns the remembered answers into short sentences', () => {
    const lines = budgetMemoryLines({
      budgetProfile: { housing: 'own', ownType: 'mortgage', incomeType: 'freelance', partnerRole: 'shares', debtStrategy: 'snowball', retirement: 'none' },
      dependents: 2,
      securityLean: 20,
    })
    expect(lines).toContain('Owns their home and still pays a mortgage.')
    expect(lines.some((l) => l.startsWith('Self-employed'))).toBe(true)
    expect(lines).toContain('Supports 2 dependants.')
    expect(lines).toContain('Pays debts smallest balance first.')
    expect(lines).toContain('Prefers to save hard over spending comfortably.')
  })
  it('only reports a learned habit after repeated, noticeable signals', () => {
    const l = (mult: number, n: number) => budgetMemoryLines({ learned: { v: 1, everyday: { dining: { mult, n } } } })
    expect(l(0.7, 1)).toEqual([])
    expect(l(0.97, 5)).toEqual([])
    expect(l(0.7, 3)).toEqual(['Usually spends about 30% less on dining out than the standard estimate.'])
  })
  it('notes habitual rebuilding', () => {
    expect(budgetMemoryLines({ learned: { v: 1, rebuilds: 2 } }).some((x) => x.includes('rebuilds'))).toBe(true)
  })
})
