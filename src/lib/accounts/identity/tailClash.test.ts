import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from '@/lib/store/types'
import { mergeCandidateFor, tailClash } from './tailClash'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', ...over }) as PaymentMethod

describe('tailClash: the same last 4 on a card and an account', () => {
  const methods = [pm('CIB ••1234', { last4: '1234' }), pm('NBE', { last4: '9876', last4Aliases: ['5521'] })]
  it('finds the method that already answers to the number, aliases included', () => {
    expect(tailClash(methods, '1234')?.id).toBe('CIB ••1234')
    expect(tailClash(methods, '5521')?.id).toBe('NBE')
  })
  it('is free for a new number, for the method itself, and for too few digits', () => {
    expect(tailClash(methods, '4444')).toBeUndefined()
    expect(tailClash(methods, '1234', 'CIB ••1234')).toBeUndefined()
    expect(tailClash(methods, '4')).toBeUndefined()
  })
  it('ignores closed and provisional methods', () => {
    expect(tailClash([pm('old', { last4: '1234', closedAt: '2025-12-01' }), pm('p', { last4: '1234', provisional: true })], '1234')).toBeUndefined()
  })
})

describe('mergeCandidateFor: "Is this your CIB account ••5521?"', () => {
  const provisional = pm('CIB ••5521', { last4: '5521', provisional: true })
  it('offers the one CIB account with no number', () => {
    expect(mergeCandidateFor([provisional, pm('CIB'), pm('NBE')], provisional.id)?.id).toBe('CIB')
  })
  it('never guesses between two, and skips accounts that already have a number', () => {
    expect(mergeCandidateFor([provisional, pm('CIB'), pm('CIB Savings')], provisional.id)).toBeUndefined()
    expect(mergeCandidateFor([provisional, pm('CIB', { last4: '1111' })], provisional.id)).toBeUndefined()
  })
  it('only for a provisional account, never cards', () => {
    expect(mergeCandidateFor([pm('CIB ••5521', { last4: '5521' }), pm('CIB')], 'CIB ••5521')).toBeUndefined()
    expect(mergeCandidateFor([provisional, pm('CIB debit', { type: 'debit_card' })], provisional.id)).toBeUndefined()
  })
})
