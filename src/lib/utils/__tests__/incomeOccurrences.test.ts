import { describe, expect, it } from 'vitest'
import { buildOccurrences, nextAwaitingIndex, realizedForOccurrences } from '@/lib/utils/incomeOccurrences'
import { deriveDefaultPaydays, paydayDatesForWindow, shiftToBusinessDay, toISODate } from '@/lib/utils/paydaySchedule'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

// 2026-07: Jul 1 = Wednesday, Jul 4 = Saturday, Jul 5 = Sunday.
const T0 = new Date(2026, 6, 1)

function source(over: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'src1',
    name: 'Salary',
    amount: 42000,
    currency: 'EGP',
    isRecurring: true,
    recurringFrequency: 'monthly',
    dayOfMonth: 5,
    effectiveStart: '2020-01-01',
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    sourceType: 'salary',
    ...over,
  }
}

function event(over: Partial<IncomeEvent>): IncomeEvent {
  return {
    id: 'e1',
    templateId: 'src1',
    name: 'Salary',
    amount: 42000,
    currency: 'EGP',
    receivedDate: '2026-07-05',
    status: 'confirmed',
    createdAt: '2026-07-05T00:00:00Z',
    updatedAt: '2026-07-05T00:00:00Z',
    ...over,
  }
}

describe('deriveDefaultPaydays', () => {
  it('biweekly is semi-monthly: 5 → [5, 20]', () => {
    expect(deriveDefaultPaydays(5, 'biweekly')).toEqual([5, 20])
  })
  it('biweekly high anchor wraps down: 20 → [5, 20]', () => {
    expect(deriveDefaultPaydays(20, 'biweekly')).toEqual([5, 20])
  })
  it('weekly caps at 4 days, wrapping past 31', () => {
    expect(deriveDefaultPaydays(5, 'weekly')).toEqual([5, 12, 19, 26])
    expect(deriveDefaultPaydays(31, 'weekly')).toEqual([10, 17, 24, 31])
  })
  it('monthly is just the anchor', () => {
    expect(deriveDefaultPaydays(15, 'monthly')).toEqual([15])
  })
})

describe('paydayDatesForWindow', () => {
  const window = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) }

  it('weekend paydays shift to the previous Friday', () => {
    // Jul 5 2026 is a Sunday → paid Fri Jul 3.
    const dates = paydayDatesForWindow(source(), window.start, window.end)
    expect(dates.map(toISODate)).toEqual(['2026-07-03'])
  })

  it('start-of-month weekend shifts forward to Monday instead of leaving the month', () => {
    // Aug 1 2026 is a Saturday; previous Friday is Jul 31 → pay Mon Aug 3.
    expect(toISODate(shiftToBusinessDay(new Date(2026, 7, 1)))).toBe('2026-08-03')
  })

  it('biweekly paydayDays land on their business-day-adjusted dates', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [5, 20] })
    // Jul 5 Sunday → Jul 3; Jul 20 Monday stays.
    expect(paydayDatesForWindow(s, window.start, window.end).map(toISODate)).toEqual(['2026-07-03', '2026-07-20'])
  })

  it('day 29-31 clamp to short months and collapse duplicates', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [15, 30] })
    const feb = paydayDatesForWindow(s, new Date(2027, 1, 1), new Date(2027, 1, 28))
    // Feb 2027: day 15 (Mon) stays; day 30 clamps to Sun 28 → shifts to Fri 26.
    expect(feb.map(toISODate)).toEqual(['2027-02-15', '2027-02-26'])
  })

  it('a shift colliding with an existing payday reverts to the unshifted date', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [3, 5] })
    // Jul 3 is Friday; Jul 5 (Sun) wants Fri Jul 3 too → keeps Jul 5.
    expect(paydayDatesForWindow(s, window.start, window.end).map(toISODate)).toEqual(['2026-07-03', '2026-07-05'])
  })

  it('legacy weekly (no paydayDays) keeps the 7-day walk', () => {
    const s = source({ recurringFrequency: 'weekly', dayOfMonth: 3 })
    const dates = paydayDatesForWindow(s, window.start, window.end).map(toISODate)
    // Jul 3, 10, 17, 24, 31 — all Fridays in 2026, no shifts.
    expect(dates).toEqual(['2026-07-03', '2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31'])
  })
})

describe('buildOccurrences', () => {
  it('monthly source → one awaiting payday on the business-day-adjusted anchor', () => {
    const occ = buildOccurrences(source(), [], '2026-07', 1, T0)
    expect(occ).toHaveLength(1)
    expect(occ[0].date).toBe('2026-07-03')
    expect(occ[0].dueDate).toBe('2026-07-03')
    expect(occ[0].status).toBe('awaiting')
    expect(occ[0].amount).toBe(42000)
    expect(occ[0].actionable).toBe(true)
  })

  it('biweekly legacy anchor derives semi-monthly days (2 → 2 and 17)', () => {
    const occ = buildOccurrences(source({ recurringFrequency: 'biweekly', dayOfMonth: 2 }), [], '2026-07', 1, T0)
    expect(occ.map((o) => o.date)).toEqual(['2026-07-02', '2026-07-17'])
  })

  it('pairs a confirmed event to the payday and marks it received', () => {
    const occ = buildOccurrences(source(), [event({ receivedDate: '2026-07-05' })], '2026-07', 1, T0)
    expect(occ).toHaveLength(1)
    expect(occ[0].status).toBe('received')
    expect(occ[0].eventId).toBe('e1')
  })

  it('pairs by occurrenceDate first, ignoring the received date', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [5, 20] })
    const occ = buildOccurrences(s, [event({ occurrenceDate: '2026-07-20', receivedDate: '2026-07-01' })], '2026-07', 1, T0)
    expect(occ[0].status).toBe('awaiting') // Jul 3 payday untouched
    expect(occ[1].status).toBe('received')
    expect(occ[1].eventId).toBe('e1')
  })

  it('duplicate events on the same occurrenceDate collapse to the latest edit (no double count)', () => {
    const occ = buildOccurrences(
      source(),
      [
        event({ id: 'e1', occurrenceDate: '2026-07-03', amount: 42000, updatedAt: '2026-07-03T01:00:00Z' }),
        event({ id: 'e2', occurrenceDate: '2026-07-03', amount: 42000, updatedAt: '2026-07-03T02:00:00Z' }),
      ],
      '2026-07',
      1,
      T0,
    )
    expect(occ).toHaveLength(1)
    expect(occ[0].eventId).toBe('e2')
    expect(realizedForOccurrences(occ)).toBe(42000)
  })

  it('overdue 1-5 days displays late, >5 days auto-displays missed', () => {
    const late = buildOccurrences(source(), [], '2026-07', 1, new Date(2026, 6, 7))
    expect(late[0].status).toBe('late') // due Jul 3, today Jul 7 → 4 days over
    expect(realizedForOccurrences(late)).toBe(0) // overdue ≠ money received
    const missed = buildOccurrences(source(), [], '2026-07', 1, new Date(2026, 6, 12))
    expect(missed[0].status).toBe('missed') // 9 days over
    expect(realizedForOccurrences(missed)).toBe(0)
  })

  it('sequential settling: only the earliest pending payday is actionable', () => {
    const s = source({ recurringFrequency: 'weekly', paydayDays: [3, 10, 17, 24] })
    const occ = buildOccurrences(s, [event({ occurrenceDate: '2026-07-03' })], '2026-07', 1, T0)
    expect(occ.map((o) => o.actionable)).toEqual([true, true, false, false])
  })

  it('auto-missed paydays stay actionable and unblock the next one', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [3, 20] })
    const occ = buildOccurrences(s, [], '2026-07', 1, new Date(2026, 6, 12))
    expect(occ[0].status).toBe('missed')
    expect(occ[0].actionable).toBe(true)
    expect(occ[1].status).toBe('awaiting')
    expect(occ[1].actionable).toBe(true)
  })

  it('an overdue unpaid payday with a paid payday after it displays missed but stays backfillable', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [3, 20] })
    // Today Jul 7: Jul 3 is overdue (late) and Jul 20 already received → Jul 3 shows missed,
    // but a past gap can always be caught up, so it stays actionable.
    const occ = buildOccurrences(s, [event({ occurrenceDate: '2026-07-20' })], '2026-07', 1, new Date(2026, 6, 7))
    expect(occ[0].status).toBe('missed')
    expect(occ[0].actionable).toBe(true)
    expect(occ[1].status).toBe('received')
  })

  it('a future payday is never marked missed even if a later payday was paid early', () => {
    const s = source({ recurringFrequency: 'biweekly', paydayDays: [5, 20] })
    // Today Jul 1: Jul 3 payday still in the future → stays awaiting despite Jul 20 paid.
    const occ = buildOccurrences(s, [event({ occurrenceDate: '2026-07-20' })], '2026-07', 1, T0)
    expect(occ[0].status).toBe('awaiting')
    expect(occ[1].status).toBe('received')
  })

  it('partial event stores the lower amount and is realized', () => {
    const occ = buildOccurrences(source(), [event({ status: 'partial', amount: 30000 })], '2026-07', 1, T0)
    expect(occ[0].status).toBe('partial')
    expect(realizedForOccurrences(occ)).toBe(30000)
  })

  it('missed does not count toward realized', () => {
    const occ = buildOccurrences(source(), [event({ status: 'missed' })], '2026-07', 1, T0)
    expect(realizedForOccurrences(occ)).toBe(0)
  })

  it('projected events are ignored (still awaiting)', () => {
    const occ = buildOccurrences(source(), [event({ status: 'projected' })], '2026-07', 1, T0)
    expect(occ[0].status).toBe('awaiting')
  })

  it('next awaiting index skips realized paydays', () => {
    const occ = buildOccurrences(
      source({ recurringFrequency: 'biweekly', dayOfMonth: 2 }),
      [event({ id: 'e1', receivedDate: '2026-07-02', amount: 21000 })],
      '2026-07',
      1,
      T0,
    )
    expect(occ[0].status).toBe('received')
    expect(nextAwaitingIndex(occ)).toBe(1)
  })

  it('merges multiple same-date legacy receipts into ONE entry (summed), not duplicates', () => {
    const occ = buildOccurrences(
      source(),
      [
        event({ id: 'e1', receivedDate: '2026-07-09', amount: 40000, status: 'partial', createdAt: '2026-07-09T01:00:00Z' }),
        event({ id: 'e2', receivedDate: '2026-07-09', amount: 30000, status: 'partial', createdAt: '2026-07-09T02:00:00Z' }),
      ],
      '2026-07',
      1,
      T0,
    )
    expect(occ).toHaveLength(1) // one entry, not two
    expect(occ[0].amount).toBe(70000) // 40k + 30k summed
    expect(occ[0].status).toBe('received') // 70k >= expected 42k
    expect(occ[0].eventId).toBe('e1') // first event drives the edit CTA
  })

  it('surplus legacy receipts beyond the payday count append as extra entries', () => {
    const occ = buildOccurrences(
      source(),
      [
        event({ id: 'e1', receivedDate: '2026-07-05', amount: 42000 }),
        event({ id: 'e2', receivedDate: '2026-07-09', amount: 10000 }),
      ],
      '2026-07',
      1,
      T0,
    )
    expect(occ).toHaveLength(2)
    expect(realizedForOccurrences(occ)).toBe(52000)
  })

  it('returns nothing when the source is not active in the window', () => {
    const occ = buildOccurrences(source({ effectiveEnd: '2026-06-30' }), [], '2026-07', 1, T0)
    expect(occ).toHaveLength(0)
  })
})
