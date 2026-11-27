import { describe, expect, it } from 'vitest'
import { nextPaydays } from './nextPaydays'
import { toISODate } from '@/lib/utils/paydaySchedule'

const iso = (ds: Date[]) => ds.map(toISODate)

describe('nextPaydays', () => {
  it('lists the next three monthly paydays from today, the weekend rule applied', () => {
    // 2026-10-28 is a Wednesday. Nov 25 is a Wednesday, Dec 25 a Friday (Fri+Sat weekend → Thursday), Jan 25 a Monday.
    expect(iso(nextPaydays({ frequency: 'monthly', paydays: [25] }, new Date(2026, 9, 28), 3, 5))).toEqual(['2026-11-25', '2026-12-24', '2027-01-25'])
  })

  it('includes today when today is a payday', () => {
    expect(iso(nextPaydays({ frequency: 'monthly', paydays: [28] }, new Date(2026, 9, 28), 1))[0]).toBe('2026-10-28')
  })

  it('lists the nearer days of a biweekly source first', () => {
    expect(iso(nextPaydays({ frequency: 'biweekly', paydays: [1, 15] }, new Date(2026, 9, 28), 3, 5))).toEqual(['2026-11-01', '2026-11-15', '2026-12-01'])
  })

  it('has no dates for an irregular source', () => {
    expect(nextPaydays({ frequency: 'monthly', paydays: [25], irregular: true }, new Date(2026, 9, 28))).toEqual([])
  })
})
