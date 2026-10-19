import { describe, expect, it } from 'vitest'
import { getMonthRange } from '@/lib/utils/calculations'

describe('getMonthRange start day', () => {
  it('uses the calendar month for day 1', () => {
    const { start, end } = getMonthRange('2026-03', 1)
    expect([start.getMonth(), start.getDate(), end.getMonth(), end.getDate()]).toEqual([2, 1, 2, 31])
  })
  it('clamps a 29-31 start day to 28 so it never rolls into the next month', () => {
    const { start, end } = getMonthRange('2026-02', 31)
    expect([start.getMonth(), start.getDate()]).toEqual([1, 28])
    expect([end.getMonth(), end.getDate()]).toEqual([2, 27])
  })
})
