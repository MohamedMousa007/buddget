import { describe, it, expect } from 'vitest'
import { buildClose, type CloseLine } from '@/lib/budget/monthClose'

const line = (p: Partial<CloseLine> & Pick<CloseLine, 'id' | 'cap' | 'spent'>): CloseLine => ({
  name: p.id, block: 'everyday', average: null, monthsOver: 0, locked: false, linked: false, ...p,
})

describe('buildClose', () => {
  it('summarises spend lines only and ranks the overruns', () => {
    const c = buildClose([
      line({ id: 'dining', cap: 1000, spent: 1300 }),
      line({ id: 'rent', cap: 4000, spent: 4000, block: 'bills' }),
      line({ id: 'goal', cap: 500, spent: 0, block: 'goals' }),
    ])
    expect(c.summary.planned).toBe(5000)
    expect(c.summary.spent).toBe(5300)
    expect(c.summary.result).toEqual({ kind: 'over', amount: 300 })
    expect(c.summary.over).toEqual([{ id: 'dining', name: 'dining', by: 300 }])
  })

  it('never proposes lowering a line to zero', () => {
    const c = buildClose([line({ id: 'unused', cap: 400, spent: 0, average: 0 })])
    expect(c.proposals).toEqual([])
  })

  it('proposes the biggest fixes first: lowering a line that stays low, raising one that kept overrunning', () => {
    const c = buildClose([
      line({ id: 'dining', cap: 1000, spent: 1250, average: 1200, monthsOver: 3 }),
      line({ id: 'fun', cap: 800, spent: 200, average: 250 }),
      line({ id: 'fresh', cap: 500, spent: 700, average: 700, monthsOver: 1 }),
    ])
    expect(c.proposals).toEqual([
      { lineId: 'fun', name: 'fun', kind: 'lower', from: 800, to: 275, months: 0, average: 250 },
      { lineId: 'dining', name: 'dining', kind: 'raise', from: 1000, to: 1200, months: 3, average: 1200 },
    ])
  })

  it('never proposes for locked, linked or history-less lines', () => {
    const c = buildClose([
      line({ id: 'a', cap: 1000, spent: 2000, average: 2000, monthsOver: 3, locked: true }),
      line({ id: 'b', cap: 1000, spent: 2000, average: 2000, monthsOver: 3, linked: true }),
      line({ id: 'c', cap: 1000, spent: 2000, monthsOver: 3 }),
    ])
    expect(c.proposals).toEqual([])
  })
})
