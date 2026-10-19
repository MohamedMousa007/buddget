import { describe, it, expect } from 'vitest'
import { stressPlan, type StressLine } from '@/lib/budget/stressTest'

const L = (id: string, block: StressLine['block'], amount: number, p: Partial<StressLine> = {}): StressLine => ({
  id, name: id, block, amount, essential: false, locked: false, linked: false, ...p,
})
const lines = [
  L('rent', 'bills', 4000, { essential: true }),
  L('food', 'everyday', 3000, { essential: true }),
  L('fun', 'everyday', 1500),
  L('buffer', 'grow', 1500),
]

describe('stressPlan', () => {
  it('a balanced plan stays balanced under a harmless shock', () => {
    const r = stressPlan(lines, 10000, { kind: 'bills', pct: 0.0001 })
    expect(r.trims).toEqual([])
    expect(r.shortfall).toBe(0)
  })

  it('income -20% trims growth first, then wants, and reports the rest', () => {
    const r = stressPlan(lines, 10000, { kind: 'income', pct: 20 })
    expect(r.income).toBe(8000)
    expect(r.free).toBe(-2000)
    expect(r.trims).toEqual([
      { id: 'buffer', name: 'buffer', from: 1500, to: 0 },
      { id: 'fun', name: 'fun', from: 1500, to: 1000 },
    ])
    expect(r.shortfall).toBe(0)
  })

  it('never trims locked or linked lines and surfaces a real shortfall', () => {
    const r = stressPlan(
      [L('rent', 'bills', 9000, { essential: true }), L('fun', 'everyday', 1000, { locked: true }), L('cc', 'debts', 500, { linked: true })],
      10000,
      { kind: 'income', pct: 30 },
    )
    expect(r.trims).toEqual([])
    expect(r.shortfall).toBe(3500)
  })

  it('bills +10% raises only the bills block', () => {
    const r = stressPlan(lines, 10000, { kind: 'bills', pct: 10 })
    expect(r.total).toBe(10000 + 400)
    expect(r.free).toBe(-400)
  })
})
