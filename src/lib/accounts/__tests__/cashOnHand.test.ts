import { describe, expect, it } from 'vitest'
import { CASH_ASK_KEY, shouldAskCashOnHand } from '../cashOnHand'

const cash = { id: 'c1', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: false } as never
const tracked = { ...(cash as object), openingBalance: 300, openingAt: '2026-11-01T00:00:00Z' } as never
const bank = { id: 'b1', name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false } as never

describe('ask once: how much cash do you have?', () => {
  it('asks after the first expense paid with an untracked Cash', () => {
    expect(shouldAskCashOnHand([cash, bank], 'c1', [])).toBe(true)
  })
  it('an expense on the built-in Cash counts as Cash', () => {
    expect(shouldAskCashOnHand([cash, bank], 'pm_default_cash', [])).toBe(true)
  })
  it('never again once asked (answered or skipped)', () => {
    expect(shouldAskCashOnHand([cash, bank], 'c1', [CASH_ASK_KEY])).toBe(false)
  })
  it('not when Cash already has a balance, or the expense was not cash', () => {
    expect(shouldAskCashOnHand([tracked, bank], 'c1', [])).toBe(false)
    expect(shouldAskCashOnHand([cash, bank], 'b1', [])).toBe(false)
  })
})
