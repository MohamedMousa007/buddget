import { describe, expect, it } from 'vitest'
import { paydayState } from '@/lib/income/paydaySummary'
import { paydayMethodId, paydayMethodLabel } from '@/lib/income/paydayMethod'
import type { IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { PaymentMethod } from '@/lib/store/types'

const today = new Date(2026, 10, 26, 12)
const occ = (over: Partial<IncomeOccurrence>): IncomeOccurrence =>
  ({ key: over.dueDate ?? 'k', date: '2026-11-05', dueDate: '2026-11-05', status: 'awaiting', amount: 52000, currency: 'EGP', actionable: true, ...over }) as IncomeOccurrence

describe('paydayState: one late and missed rule', () => {
  it('Oct 5 (52 days, past its grace) and Nov 5 (marked missed) both read as missed', () => {
    expect(paydayState(occ({ dueDate: '2026-10-05', status: 'missed' }), today)).toEqual({ kind: 'missed', marked: false })
    expect(paydayState(occ({ dueDate: '2026-11-05', status: 'missed', eventId: 'e1' }), today)).toEqual({ kind: 'missed', marked: true })
  })
  it('inside the grace with nothing recorded it is late by the days since the due date', () => {
    expect(paydayState(occ({ dueDate: '2026-11-23', status: 'late' }), today)).toEqual({ kind: 'late', days: 3 })
  })
  it('a future payday is due; recorded ones are received, late or partial', () => {
    expect(paydayState(occ({ dueDate: '2026-12-05' }), today)).toEqual({ kind: 'due' })
    expect(paydayState(occ({ eventId: 'e', status: 'received' }), today)).toEqual({ kind: 'received' })
    expect(paydayState(occ({ eventId: 'e', status: 'received', daysLate: 2 }), today)).toEqual({ kind: 'arrivedLate', days: 2 })
    expect(paydayState(occ({ eventId: 'e', status: 'partial' }), today)).toEqual({ kind: 'partial' })
  })
})

describe('payday "Received in": one source for the list and the edit sheet', () => {
  const pms = [{ id: 'pm1', name: 'CIB ••1234', last4: '1234' }] as unknown as PaymentMethod[]
  it('reads the stored account, never the app default', () => {
    expect(paydayMethodId({ paymentMethodId: 'pm1' }, pms)).toBe('pm1')
    expect(paydayMethodId({ paymentMethodId: undefined }, pms)).toBe('')
    expect(paydayMethodId({ paymentMethodId: 'gone' }, pms)).toBe('')
  })
  it('labels it as the sheet row does', () => {
    expect(paydayMethodLabel({ paymentMethodId: 'pm1' }, pms)).toBe('CIB ••1234')
    expect(paydayMethodLabel({ paymentMethodId: undefined }, pms)).toBeNull()
  })
})
