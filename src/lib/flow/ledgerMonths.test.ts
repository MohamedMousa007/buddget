import { describe, expect, it } from 'vitest'
import { monthHeads } from '@/lib/flow/ledgerMonths'

describe('monthHeads', () => {
  it('puts one head on the first day of each month with the month total', () => {
    const out = monthHeads([
      { day: '2026-10-28', rows: 2 },
      { day: '2026-10-27', rows: 3 },
      { day: '2026-09-30', rows: 1 },
      { day: '2026-09-02', rows: 4 },
    ])
    expect(out).toEqual([{ month: '2026-10', count: 5 }, null, { month: '2026-09', count: 5 }, null])
  })

  it('handles an empty list', () => {
    expect(monthHeads([])).toEqual([])
  })
})
