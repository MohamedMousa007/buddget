import { describe, expect, it } from 'vitest'
import { paydayDatesForWindow, toISODate, type WeekendFirstDay } from '@/lib/utils/paydaySchedule'
import { getMonthRange } from '@/lib/utils/calculations'
import type { IncomeSource } from '@/lib/store/types'

const src = (paydayDays: number[]): IncomeSource => ({
  id: 's', name: 'x', amount: 100, currency: 'EGP', isRecurring: true, recurringFrequency: 'biweekly', dayOfMonth: paydayDays[0], paydayDays,
  effectiveStart: '2020-01-01', createdAt: '', updatedAt: '',
} as IncomeSource)
const run = (days: number[], key: string, sd: number, wf: WeekendFirstDay) => {
  const { start, end } = getMonthRange(key, sd)
  return paydayDatesForWindow(src(days), start, end, true, wf).map(toISODate)
}

describe('FUZ-1: no payday is emitted twice on the Cairo DST-start Friday', () => {
  it.each([
    [[28, 29], '2028-04', 28],
    [[24, 25], '2025-04', 24],
    [[23, 24], '2026-04', 23],
    [[1, 30], '2027-04', 2],
  ])('%j %s sd=%i', (days, key, sd) => {
    const out = run(days as number[], key as string, sd as number, 5)
    expect(new Set(out).size).toBe(out.length)
    expect(out).toHaveLength(2)
  })
})

describe('FUZ-2: a weekend shift colliding with an adjacent payday never drops a payday', () => {
  it('[1,2] in Jan 2023 (1st is a Sunday): both paydays survive on distinct dates', () => {
    const out = run([1, 2], '2023-01', 1, 6)
    expect(out).toEqual(['2023-01-02', '2023-01-03'])
  })
  it('[1,28] with start day 28, Feb 28 2026 on the weekend', () => {
    const out = run([1, 28], '2026-02', 28, 5)
    expect(out).toHaveLength(2)
    expect(new Set(out).size).toBe(2)
  })
  it('existing rule kept: a shift onto an existing payday reverts to the unshifted date', () => {
    expect(run([3, 5], '2026-07', 1, 6)).toEqual(['2026-07-03', '2026-07-05'])
  })
  it('every pair of paydays keeps its count over all months, both weekends, start days 1 and 28', () => {
    for (const wf of [5, 6] as WeekendFirstDay[])
      for (const sd of [1, 28])
        for (let y = 2023; y <= 2028; y++)
          for (let m = 1; m <= 12; m++)
            for (const days of [[1, 2], [1, 3], [2, 3], [1, 28], [1, 31], [28, 29], [29, 30]]) {
              const key = `${y}-${String(m).padStart(2, '0')}`
              const { start, end } = getMonthRange(key, sd)
              const out = run(days, key, sd, wf)
              expect(new Set(out).size).toBe(out.length)
              const raw = new Set<string>()
              for (const mm of [m - 2, m - 1, m, m + 1]) {
                const dim = new Date(y, mm, 0).getDate()
                for (const d of days) { const dt = new Date(y, mm - 1, Math.min(d, dim)); if (dt >= start && dt <= end) raw.add(toISODate(dt)) }
              }
              expect(out.length).toBe(raw.size)
            }
  })
})
