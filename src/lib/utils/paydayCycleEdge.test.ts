import { describe, it, expect } from 'vitest'
import { getMonthRange } from '@/lib/utils/calculations'
import { paydayDatesForWindow } from '@/lib/utils/paydaySchedule'
import type { IncomeSource } from '@/lib/store/types'

const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
const src = (over: Partial<IncomeSource>) => ({ id: 's1', name: 'Salary', amount: 1000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly',
  dayOfMonth: 5, effectiveStart: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z', ...over }) as IncomeSource

describe('payday windows', () => {
  it('a monthly payday lands in exactly one cycle, for every month start day and payday, weekend or not', () => {
    const bad: string[] = []
    for (let sd = 1; sd <= 28; sd++) for (let pd = 1; pd <= 31; pd++) {
      const s = src({ dayOfMonth: pd, paydayDays: [pd] })
      for (let y = 2025; y <= 2027; y++) for (let m = 0; m < 12; m++) {
        const { start, end } = getMonthRange(key(y, m), sd)
        const n = paydayDatesForWindow(s, start, end).length
        if (n !== 1) bad.push(`sd=${sd} pd=${pd} ${key(y, m)} n=${n}`)
      }
    }
    expect(bad.slice(0, 8)).toEqual([])
  })
})
