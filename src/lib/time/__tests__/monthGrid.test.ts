import { describe, expect, it } from 'vitest'
import { buildMonthGrid, pickerYears, weekdayColumns } from '@/lib/time/monthGrid'

describe('buildMonthGrid', () => {
  // 1 Oct 2026 is a Thursday.
  it('opens the first column on the chosen day', () => {
    const sun = buildMonthGrid(2026, 9, 0)
    expect(sun[4]).toMatchObject({ d: 1, m: 9, out: false })
    const sat = buildMonthGrid(2026, 9, 6)
    expect(sat[5]).toMatchObject({ d: 1, m: 9, out: false })
    expect(sat[0]).toMatchObject({ d: 26, m: 8, out: true })
    const mon = buildMonthGrid(2026, 9, 1)
    expect(mon[3]).toMatchObject({ d: 1, m: 9, out: false })
    expect(sat).toHaveLength(42)
  })
  it('lists weekday columns from the week start', () => {
    expect(weekdayColumns(6)).toEqual([6, 0, 1, 2, 3, 4, 5])
    expect(weekdayColumns(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })
  it('offers years well beyond 2035', () => {
    const ys = pickerYears(new Date(2026, 9, 29))
    expect(ys[0]).toBe(1970)
    expect(ys[ys.length - 1]).toBe(2076)
    expect(ys).toContain(2060)
  })
})
