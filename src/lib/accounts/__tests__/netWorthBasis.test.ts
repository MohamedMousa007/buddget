import { describe, expect, it } from 'vitest'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { accountsBasisFor } from '../netWorthBasis'

const bank = { id: 'b', name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false, openingBalance: 1000, openingAt: '2026-01-01T00:00:00Z' } as PaymentMethod
const usd = { ...bank, id: 'u', currency: 'USD', openingBalance: 10 } as PaymentMethod
const ledger = (pms: PaymentMethod[], savingsAccounts: SavingsAccount[] = []) => ({
  paymentMethods: pms, expenses: [], incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [], savingsAccounts, adjustments: [],
  convert: (a: number, f: string, t: string) => (f === t ? a : f === 'USD' && t === 'EGP' ? a * 50 : null),
})

describe('accountsBasisFor', () => {
  it('is empty until an account has a starting balance', () => {
    expect(accountsBasisFor(ledger([{ ...bank, openingBalance: undefined } as PaymentMethod]), 'EGP')).toEqual({})
  })
  it('leaves out an account with no rate to base and flags the basis incomplete (QA-88)', () => {
    const jpy = { ...bank, id: 'j', currency: 'EUR', openingBalance: 500 } as PaymentMethod
    expect(accountsBasisFor(ledger([bank, jpy]), 'EGP')).toMatchObject({ accountsBasis: 1000, accountsIncomplete: true })
  })
  it('sums tracked balances in base currency and lists pockets held inside them', () => {
    const pocket = { id: 'p', heldInPaymentMethodId: 'b' } as SavingsAccount
    const r = accountsBasisFor(ledger([bank, usd], [pocket]), 'EGP')
    expect(r).toMatchObject({ accountsBasis: 1500 })
    expect([...((r as unknown as { heldInPocketIds: Set<string> }).heldInPocketIds)]).toEqual(['p'])
  })
  // LOGIC_SPEC §0 "Money in a closed account: counts zero" replaces BUD-100's "its pocket counts on its own".
  it('a closed account leaves the total and so does its pocket, which is listed for repair (T19)', () => {
    const closed = { ...bank, closedAt: '2026-11-01T00:00:00Z' } as PaymentMethod
    const pocket = { id: 'p', heldInPaymentMethodId: 'b' } as SavingsAccount
    const r = accountsBasisFor(ledger([closed, usd], [pocket]), 'EGP')
    expect(r).toMatchObject({ accountsBasis: 500, needsRepair: ['p'] })
    expect([...(r.heldInPocketIds ?? [])]).toEqual([])
    expect([...(r.goneHolderPocketIds ?? [])]).toEqual(['p'])
  })
})
