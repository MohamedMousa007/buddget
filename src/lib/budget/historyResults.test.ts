import { describe, expect, it } from 'vitest'
import { monthKeysBetween, monthResult } from '@/lib/budget/historyResults'

describe('monthResult', () => {
  it('over, kept, on plan and unknown', () => {
    expect(monthResult(10640, 10000)).toEqual({ kind: 'over', amount: 640 })
    expect(monthResult(9800, 10000)).toEqual({ kind: 'kept', percent: 2 })
    expect(monthResult(9900, 10000)).toEqual({ kind: 'onPlan' })
    expect(monthResult(5000, 0)).toBeNull()
  })
})

describe('monthKeysBetween', () => {
  it('spans a year boundary inclusively', () => {
    expect(monthKeysBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthKeysBetween('2026-10', '2026-10')).toEqual(['2026-10'])
    expect(monthKeysBetween('2026-10', '2026-09')).toEqual([])
  })
})
