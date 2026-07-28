import { describe, it, expect } from 'vitest'
import { computeEmergencyFund } from './emergencyFund'

describe('computeEmergencyFund', () => {
  it('months covered = cover ÷ essentials', () => {
    const r = computeEmergencyFund({ coverAmount: 60_000, monthlyEssentials: 10_000, targetMonths: 6 })
    expect(r.monthsCovered).toBe(6)
    expect(r.neededForTarget).toBe(60_000)
    expect(r.gap).toBe(0)
    expect(r.atOrAboveTarget).toBe(true)
  })

  it('reports the shortfall below target', () => {
    const r = computeEmergencyFund({ coverAmount: 30_000, monthlyEssentials: 10_000, targetMonths: 6 })
    expect(r.monthsCovered).toBe(3)
    expect(r.gap).toBe(30_000)
    expect(r.atOrAboveTarget).toBe(false)
  })

  it('guards division by zero essentials — no Infinity', () => {
    const r = computeEmergencyFund({ coverAmount: 50_000, monthlyEssentials: 0, targetMonths: 6 })
    expect(Number.isFinite(r.monthsCovered)).toBe(true)
    expect(r.monthsCovered).toBe(0)
    expect(r.atOrAboveTarget).toBe(true)
  })

  it('clamps negative inputs', () => {
    const r = computeEmergencyFund({ coverAmount: -100, monthlyEssentials: 10_000, targetMonths: 6 })
    expect(r.monthsCovered).toBe(0)
  })
})
