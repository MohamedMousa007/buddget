import { describe, expect, it } from 'vitest'
import { defaultMethodId, storedMethodId } from '@/lib/accounts/resolve'
import { filterablePaymentMethods } from '@/lib/accounts/kinds'
import type { PaymentMethod } from '@/lib/store/types'

// The built-in method exactly as defaultFinanceData seeds it, and the row AddAccountSheet creates when cash is tracked.
const sentinel = { id: 'pm_default_cash', name: 'Cash', type: 'cash', isDefault: true } as PaymentMethod
const realCash = { id: 'c1', name: 'Cash', type: 'cash', isDefault: false, createdAt: '2026-01-01', openingBalance: 50, openingAt: '2026-01-01T00:00:00Z' } as PaymentMethod
const card = { id: 'k1', name: 'Card', type: 'credit_card', isDefault: false } as PaymentMethod

describe('QA-50/QA-18: the Cash sentinel is never preselected or stored once a real Cash exists', () => {
  it('preselects the real Cash account when the default is the built-in one', () => {
    expect(defaultMethodId([sentinel, realCash, card])).toBe('c1')
    expect(storedMethodId('pm_default_cash', [sentinel, realCash])).toBe('c1')
  })
  it('keeps the built-in one while no real Cash exists, and any other choice as is', () => {
    expect(defaultMethodId([sentinel, card])).toBe('pm_default_cash')
    expect(storedMethodId('k1', [sentinel, realCash, card])).toBe('k1')
  })
  it('skips closed methods and returns empty when there are none', () => {
    expect(defaultMethodId([{ ...card, isDefault: true, closedAt: '2026-02-01' } as PaymentMethod, realCash])).toBe('c1')
    expect(defaultMethodId([])).toBe('')
  })
})

describe('QA-18: the expense filter offers one Cash and still finds old rows', () => {
  const closed = { id: 'o1', name: 'Old', type: 'bank_account', isDefault: false, closedAt: '2026-02-01' } as PaymentMethod
  it('hides the built-in Cash once a real one exists, and keeps closed methods', () => {
    expect(filterablePaymentMethods([sentinel, realCash, closed]).map((m) => m.id)).toEqual(['c1', 'o1'])
    expect(filterablePaymentMethods([sentinel, card]).map((m) => m.id)).toEqual(['pm_default_cash', 'k1'])
  })
  it('a row saved with the built-in id is found under the real Cash', () => {
    expect(storedMethodId('pm_default_cash', [sentinel, realCash])).toBe('c1')
  })
})

describe('BUD-87: which method a payment defaults to', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  const bank = { id: 'b1', name: 'Bank', type: 'bank_account', isDefault: false, createdAt: '2026-01-01' } as PaymentMethod
  const wallet = { id: 'w1', name: 'Wallet', type: 'wallet', isDefault: false, createdAt: '2026-02-01' } as PaymentMethod
  const sms = (paymentMethodId: string, date: string) => ({ paymentMethodId, date, smsLogId: `log-${paymentMethodId}-${date}` })

  it('the user\'s own choice wins, untracked Cash included, over the method bank messages use', () => {
    const chosenCash = { ...realCash, isDefault: true }
    expect(defaultMethodId([sentinel, chosenCash, bank], [sms('b1', '2026-11-20')], now)).toBe('c1')
    expect(defaultMethodId([{ ...card, isDefault: true }, bank], [sms('b1', '2026-11-20')], now)).toBe('k1')
  })

  it('with no choice, the method bank messages book to most beats Cash', () => {
    const expenses = [sms('b1', '2026-11-20'), sms('w1', '2026-11-21'), sms('w1', '2026-11-22')]
    expect(defaultMethodId([sentinel, realCash, bank, wallet], expenses, now)).toBe('w1')
  })

  it('a tie goes to the method with the latest message', () => {
    expect(defaultMethodId([sentinel, bank, wallet], [sms('b1', '2026-11-22'), sms('w1', '2026-11-21')], now)).toBe('b1')
  })

  it('the built-in Cash\'s seeded mark is not a choice', () => {
    expect(defaultMethodId([sentinel, bank], [sms('b1', '2026-11-20')], now)).toBe('b1')
  })

  it('skips provisional, excluded, closed and BNPL methods, old messages and hand-entered expenses', () => {
    const methods = [
      sentinel,
      { ...bank, provisional: true },
      { ...wallet, excluded: true },
      { id: 'n1', name: 'Tabby', type: 'bnpl', isDefault: false } as PaymentMethod,
      { id: 'x1', name: 'Old', type: 'bank_account', isDefault: false, closedAt: '2026-10-01' } as PaymentMethod,
      card,
    ]
    const expenses = [sms('b1', '2026-11-20'), sms('w1', '2026-11-20'), sms('n1', '2026-11-20'), sms('x1', '2026-11-20'), sms('k1', '2026-08-01'), { paymentMethodId: 'k1', date: '2026-11-20' }]
    expect(defaultMethodId(methods, expenses, now)).toBe('pm_default_cash')
  })

  it('no messages: Cash, else the first open method', () => {
    expect(defaultMethodId([bank, realCash], [], now)).toBe('c1')
    expect(defaultMethodId([bank, wallet], [], now)).toBe('b1')
  })
})
