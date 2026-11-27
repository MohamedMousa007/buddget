import { describe, expect, it } from 'vitest'
import { latePaydays, paydayCandidates } from './paydayResolution'
import { focusPayday, overdueDays, paydayState } from './paydaySummary'
import { buildOccurrences } from '@/lib/utils/incomeOccurrences'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

const today = new Date(2026, 8, 28)
const free: IncomeSource = {
  id: 'free', name: 'Freelance', amount: 4000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 1,
  irregular: true, effectiveStart: '2026-07-01', createdAt: '2026-07-01', updatedAt: '2026-07-01', sourceType: 'other',
}
const credit: IncomeEvent = {
  id: 'c', name: 'ACME LLC', amount: 4100, currency: 'EGP', receivedDate: '2026-09-20', status: 'confirmed', createdAt: '2026-09-20', updatedAt: '2026-09-20',
}

describe('irregular income is never late', () => {
  it('an unpaid month weeks past its day stays awaiting, never late or missed', () => {
    const [o] = buildOccurrences(free, [], '2026-08', 1, today)
    expect(o.status).toBe('awaiting')
    expect(o.irregular).toBe(true)
    expect(overdueDays(o, today)).toBe(0)
    expect(paydayState(o, today).kind).toBe('due')
  })

  it('is not in the late paydays Flow asks about, and a regular source still is', () => {
    const salary: IncomeSource = { ...free, id: 'salary', irregular: undefined, sourceType: 'salary', dayOfMonth: 7 }
    expect([...new Set(latePaydays([free, salary], [], 1, today).map((l) => l.source.id))]).toEqual(['salary'])
  })

  it('is not the open payday the source page talks about', () => {
    const occ = buildOccurrences(free, [], '2026-09', 1, today)
    expect(focusPayday(occ, today)?.irregular).toBe(true)
    expect(occ.every((o) => o.status === 'awaiting')).toBe(true)
  })

  it('can still take money: a credit is offered for its month and fills it', () => {
    const [cand] = paydayCandidates(credit, [free], [], 1, {}, today)
    expect(cand.source.id).toBe('free')
    expect(cand.occ.dueDate.slice(0, 7)).toBe('2026-09')
    const filled = buildOccurrences(free, [{ ...credit, templateId: 'free', occurrenceDate: cand.occ.dueDate }], '2026-09', 1, today)
    expect(filled[0]).toMatchObject({ eventId: 'c', status: 'received' })
    // Sep 20 against the placeholder day 1 is not "19 days late".
    expect(filled[0].daysLate).toBeUndefined()
    expect(paydayState(filled[0], today).kind).toBe('received')
  })
})
