import { describe, expect, it } from 'vitest'
import { buildOccurrences, nextAwaitingIndex, realizedForOccurrences } from '@/lib/utils/incomeOccurrences'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

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

describe('buildOccurrences', () => {
  it('monthly source → one awaiting payday on the anchor day', () => {
    const occ = buildOccurrences(source(), [], '2026-07')
    expect(occ).toHaveLength(1)
    expect(occ[0].date).toBe('2026-07-05')
    expect(occ[0].status).toBe('awaiting')
    expect(occ[0].amount).toBe(42000)
  })

  it('weekly source → 4-5 paydays derived from the anchor', () => {
    const occ = buildOccurrences(source({ recurringFrequency: 'weekly', dayOfMonth: 3 }), [], '2026-07')
    expect(occ.length).toBeGreaterThanOrEqual(4)
    // every derived payday is 7 days apart
    for (let i = 1; i < occ.length; i++) {
      const gap = (Date.parse(occ[i].date) - Date.parse(occ[i - 1].date)) / 86_400_000
      expect(gap).toBe(7)
    }
  })

  it('biweekly source → paydays 14 days apart', () => {
    const occ = buildOccurrences(source({ recurringFrequency: 'biweekly', dayOfMonth: 2 }), [], '2026-07')
    expect(occ.length).toBeGreaterThanOrEqual(2)
    const gap = (Date.parse(occ[1].date) - Date.parse(occ[0].date)) / 86_400_000
    expect(gap).toBe(14)
  })

  it('pairs a confirmed event to the payday and marks it received', () => {
    const occ = buildOccurrences(source(), [event({ receivedDate: '2026-07-05' })], '2026-07')
    expect(occ).toHaveLength(1)
    expect(occ[0].status).toBe('received')
    expect(occ[0].eventId).toBe('e1')
  })

  it('partial event stores the lower amount and is realized', () => {
    const occ = buildOccurrences(source(), [event({ status: 'partial', amount: 30000 })], '2026-07')
    expect(occ[0].status).toBe('partial')
    expect(realizedForOccurrences(occ)).toBe(30000)
  })

  it('missed does not count toward realized', () => {
    const occ = buildOccurrences(source(), [event({ status: 'missed' })], '2026-07')
    expect(realizedForOccurrences(occ)).toBe(0)
  })

  it('projected events are ignored (still awaiting)', () => {
    const occ = buildOccurrences(source(), [event({ status: 'projected' })], '2026-07')
    expect(occ[0].status).toBe('awaiting')
  })

  it('next awaiting index skips realized paydays', () => {
    const occ = buildOccurrences(
      source({ recurringFrequency: 'biweekly', dayOfMonth: 2 }),
      [event({ id: 'e1', receivedDate: '2026-07-02', amount: 21000 })],
      '2026-07',
    )
    expect(occ[0].status).toBe('received')
    expect(nextAwaitingIndex(occ)).toBe(1)
  })

  it('returns nothing when the source is not active in the window', () => {
    const occ = buildOccurrences(source({ effectiveEnd: '2026-06-30' }), [], '2026-07')
    expect(occ).toHaveLength(0)
  })
})
