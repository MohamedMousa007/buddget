import { describe, it, expect } from 'vitest'
import { incomeMatches, latePaydays, matchKey, paydayCandidates } from './paydayResolution'
import type { IncomeEvent, IncomeSource } from '@/lib/store/types'

const today = new Date(2026, 8, 28)
const src = (id: string, amount: number, day: number, drift: number | null = null): IncomeSource => ({
  id, name: id, amount, currency: 'SAR', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: day,
  paydayDriftDays: drift, effectiveStart: '2026-09-01', createdAt: '2026-01-01', updatedAt: '2026-01-01', sourceType: 'salary',
})
const ev = (id: string, amount: number, receivedDate: string, extra: Partial<IncomeEvent> = {}): IncomeEvent => ({
  id, name: id, amount, currency: 'SAR', receivedDate, status: 'confirmed', createdAt: receivedDate, updatedAt: receivedDate, ...extra,
})
// Sources start in September, so only September's paydays exist. Paydays are weekdays:
// the schedule shifts weekend paydays to the business day before.

describe('latePaydays', () => {
  it('flags an unfilled payday only once it is past the grace window', () => {
    const rent = src('rent', 1250, 21, 5) // Mon Sep 21, 7 days ago, grace 5
    const salary = src('salary', 14500, 25) // Fri Sep 25, 3 days ago, default grace 5
    const late = latePaydays([rent, salary], [], 1, today)
    expect(late.map((l) => [l.source.id, l.daysLate])).toEqual([['rent', 7]])
  })
})

describe('openPaydays across a mid-month cycle', () => {
  it('still sees the previous cycle when the start day is after today', () => {
    const rent = { ...src('rent', 1250, 20, 5), effectiveStart: '2026-07-01' }
    const late = latePaydays([rent], [], 25, new Date(2026, 9, 10))
    expect(late.map((l) => l.occ.date.slice(0, 7))).toContain('2026-09')
  })
})

describe('incomeMatches', () => {
  const salary = src('salary', 14500, 22)
  const credit = ev('credit', 14380, '2026-09-25')

  it('pairs a stray credit with the payday it plausibly fills', () => {
    const [m] = incomeMatches([salary], [credit], 1, {}, today, [])
    expect(m.source.id).toBe('salary')
    expect(m.occ.dueDate).toBe('2026-09-22')
    expect(Math.round(m.diff * 100)).toBe(1)
  })

  it('never re-asks a pair the user kept separate', () => {
    const [m] = incomeMatches([salary], [credit], 1, {}, today, [])
    expect(incomeMatches([salary], [credit], 1, {}, today, [matchKey('credit', m.occ.key)])).toEqual([])
  })

  it('ignores amounts outside the tolerance', () => {
    expect(incomeMatches([salary], [ev('gift', 500, '2026-09-23')], 1, {}, today, [])).toEqual([])
  })
})

describe('paydayCandidates', () => {
  it('puts the plausible match first and keeps the rest', () => {
    const salary = src('salary', 14500, 22)
    const rent = src('rent', 1250, 20)
    const list = paydayCandidates(ev('c', 14380, '2026-09-25'), [rent, salary], [], 1, {}, today)
    expect(list.map((c) => [c.source.id, c.plausible])).toEqual([['salary', true], ['rent', false]])
  })
})
