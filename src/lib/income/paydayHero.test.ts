import { describe, it, expect } from 'vitest'
import { adoptedPaydayAccount, paydayHeroFacts, paydayLogMethodId } from './paydayHero'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'

const occ = (dueDate: string, over: Partial<IncomeOccurrence> = {}): IncomeOccurrence =>
  ({ key: dueDate, date: dueDate, dueDate, status: 'awaiting', amount: 31500, currency: 'EGP', actionable: true, ...over }) as IncomeOccurrence
const got = (d: string, over: Partial<IncomeOccurrence> = {}) => occ(d, { eventId: `e${d}`, status: 'received', ...over })
const today = new Date('2026-11-20T12:00:00')

describe('paydayHeroFacts', () => {
  const run = [got('2026-05-25'), got('2026-06-25'), got('2026-07-25'), got('2026-08-25', { daysLate: 3 }), got('2026-09-25'), got('2026-10-25'), occ('2026-11-25'), occ('2026-12-25')]

  it('circles are the last six paydays already due, on time counts full on-time arrivals', () => {
    const f = paydayHeroFacts(run, today)
    expect(f.last.map((o) => o.dueDate)).toEqual(['2026-05-25', '2026-06-25', '2026-07-25', '2026-08-25', '2026-09-25', '2026-10-25'])
    expect(f.onTime).toBe(5)
    expect(f.next?.dueDate).toBe('2026-11-25')
  })

  it('an open overdue payday is a circle, not the next one; partial and missed are not on time', () => {
    const f = paydayHeroFacts([got('2026-09-25', { status: 'partial' }), occ('2026-10-25', { status: 'missed' }), occ('2026-11-25')], today)
    expect(f.last).toHaveLength(2)
    expect(f.onTime).toBe(0)
    expect(f.next?.dueDate).toBe('2026-11-25')
  })

  it('today\'s open payday is the next one', () => {
    expect(paydayHeroFacts([occ('2026-11-20')], today).next?.dueDate).toBe('2026-11-20')
  })
})

describe('payday account (QA W4: a logged payday forgets its account)', () => {
  const methods = [{ id: 'qnb' }, { id: 'cib' }]

  it('editing a logged payday starts on the account it landed in, not the payday default', () => {
    expect(paydayLogMethodId({ paymentMethodId: 'qnb' }, { paymentMethodId: 'cib' }, methods)).toBe('qnb')
    expect(paydayLogMethodId({ paymentMethodId: 'qnb' }, { paymentMethodId: undefined }, methods)).toBe('qnb')
  })

  it('a new log starts on the payday account; a deleted account is never offered', () => {
    expect(paydayLogMethodId(undefined, { paymentMethodId: 'cib' }, methods)).toBe('cib')
    expect(paydayLogMethodId({ paymentMethodId: 'gone' }, { paymentMethodId: 'gone2' }, methods)).toBe('')
  })

  it('a payday with no account adopts the one it was logged into; one with an account keeps it', () => {
    expect(adoptedPaydayAccount({ paymentMethodId: undefined }, 'qnb', methods)).toBe('qnb')
    expect(adoptedPaydayAccount({ paymentMethodId: 'gone' }, 'qnb', methods)).toBe('qnb')
    expect(adoptedPaydayAccount({ paymentMethodId: 'cib' }, 'qnb', methods)).toBeNull()
    expect(adoptedPaydayAccount({ paymentMethodId: undefined }, '', methods)).toBeNull()
  })
})
