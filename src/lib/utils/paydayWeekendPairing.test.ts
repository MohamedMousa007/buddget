import { describe, expect, it } from 'vitest'
import { buildOccurrences } from '@/lib/utils/incomeOccurrences'
import { recentPaydays } from '@/lib/income/paydaySummary'
import { paydayHeroFacts } from '@/lib/income/paydayHero'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

// Light-touch seed (Paydays phantom miss): a monthly salary on the 5th with confirmed events stamped on the 5th
// for six months, beside a bi-weekly Upwork on the 3rd. Cairo weekend is Fri+Sat, so Sat Sep 5 2026 is paid
// Thu Sep 3 and Fri Jun 5 is paid Thu Jun 4. The event stamped on the 5th must fill that payday, not leave it missed.
const source = (over: Partial<IncomeSource>): IncomeSource => ({
  id: 's', name: 'x', amount: 42000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly',
  effectiveStart: '2026-06-01', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', ...over,
} as IncomeSource)
const salary = source({ id: 'salary', name: 'Salary · Nexta', dayOfMonth: 5 })
const upwork = source({ id: 'upwork', name: 'Upwork', amount: 6000, recurringFrequency: 'biweekly', dayOfMonth: 3, effectiveStart: '2026-11-26', createdAt: '2026-11-26T00:00:00Z' })
const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
const events: IncomeEvent[] = MONTHS.map((m) => ({
  id: `ev-${m}`, templateId: salary.id, name: salary.name, amount: 42000, currency: 'EGP', sourceType: 'salary',
  receivedDate: `${m}-05`, occurrenceDate: `${m}-05`, status: 'confirmed', createdAt: `${m}-05T10:00:00Z`, updatedAt: `${m}-05T10:00:00Z`,
} as IncomeEvent))
const today = new Date('2026-11-26T12:00:00')
const FRI_SAT = 5 as const

describe('payday stamped on its raw day fills the weekend-shifted payday (two sources, different days)', () => {
  it('Sep: one received salary payday on Sep 3, no phantom missed one', () => {
    const occ = buildOccurrences(salary, events, '2026-09', 1, today, FRI_SAT)
    expect(occ).toHaveLength(1)
    expect(occ[0]).toMatchObject({ dueDate: '2026-09-03', status: 'received', eventId: 'ev-2026-09' })
    expect(occ[0].daysLate).toBeUndefined()
  })

  it('Jun (Fri the 5th → Thu the 4th) is received too', () => {
    const occ = buildOccurrences(salary, events, '2026-06', 1, today, FRI_SAT)
    expect(occ.map((o) => [o.dueDate, o.status])).toEqual([['2026-06-04', 'received']])
  })

  it('hero: six received months, on time 6 of 6, next salary payday is the shifted Dec 3 and nothing is left to log', () => {
    const run = recentPaydays(salary, events, '2026-12', 1, 8, today, FRI_SAT)
    const f = paydayHeroFacts(run, today)
    expect(f.last.map((o) => o.dueDate.slice(0, 7))).toEqual(MONTHS)
    expect(f.onTime).toBe(6)
    expect(f.next?.dueDate).toBe('2026-12-03')
    expect(run.find((o) => o.actionable && !o.eventId && o.dueDate < '2026-11-26')).toBeUndefined()
  })

  it('the other source never borrows the salary events, and keeps its own days', () => {
    const occ = buildOccurrences(upwork, events, '2026-12', 1, today, FRI_SAT)
    expect(occ.every((o) => !o.eventId)).toBe(true)
    expect(occ.map((o) => o.dueDate)).toEqual(['2026-12-03', '2026-12-17'])
  })

  it('an event too far from any payday stays an extra entry (schedule edited after logging)', () => {
    const moved = [{ ...events[3], occurrenceDate: '2026-09-20', receivedDate: '2026-09-20' }]
    const occ = buildOccurrences(salary, moved, '2026-09', 1, today, FRI_SAT)
    expect(occ.map((o) => [o.dueDate, o.eventId ?? null])).toEqual([['2026-09-03', null], ['2026-09-20', 'ev-2026-09']])
  })
})
