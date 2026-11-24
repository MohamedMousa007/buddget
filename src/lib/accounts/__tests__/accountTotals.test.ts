import { describe, expect, it } from 'vitest'
import { computeBalances, type LedgerInput } from '../balance'
import { accountTotals } from '../useAccounts'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const pm = (id: string, openingBalance: number, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2020-01-01', openingBalance, openingAt: '2020-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const pocket = (id: string, currentBalance: number, heldInPaymentMethodId: string, currency = 'EGP'): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency, currentBalance, createdAt: '2020-01-01', heldInPaymentMethodId }) as SavingsAccount
const convert = (a: number, from: string, to: string) => (from === to ? a : from === 'USD' && to === 'EGP' ? a * 50 : null)

function rows(methods: PaymentMethod[], pockets: SavingsAccount[]) {
  const ledger: LedgerInput = { paymentMethods: methods, savingsAccounts: pockets, expenses: [], incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: [], adjustments: [], convert }
  const balances = computeBalances(ledger)
  return methods.map((method) => ({ method, balance: balances.get(method.id) ?? null }))
}
const sumOfRows = (views: ReturnType<typeof rows>) =>
  views.filter((v) => v.balance && !v.method.excluded).reduce((n, v) => n + (convert(v.balance!.free, v.balance!.currency, 'EGP') ?? 0), 0)

describe('Available now equals the sum of the account rows (R3)', () => {
  it('an over-reserved account contributes zero and takes nothing from another account', () => {
    const views = rows([pm('A', 20000), pm('B', 50000)], [pocket('trip', 30000, 'A')])
    const t = accountTotals(views, 'EGP', convert)
    expect(views.map((v) => v.balance!.free)).toEqual([0, 50000])
    expect(t.freeInBase).toBe(50000)
    expect(t.freeInBase).toBe(sumOfRows(views))
    expect(t.totalInBase).toBe(70000)
    expect(t.heldInBase).toBe(30000)
  })

  it('with nothing over-reserved it is balances minus set aside', () => {
    const views = rows([pm('A', 20000), pm('B', 50000)], [pocket('trip', 5000, 'A'), pocket('car', 10000, 'B')])
    const t = accountTotals(views, 'EGP', convert)
    expect(t.freeInBase).toBe(55000)
    expect(t.freeInBase).toBe(t.totalInBase - t.heldInBase)
    expect(t.freeInBase).toBe(sumOfRows(views))
  })

  it('converts each row to the base currency, and leaves out excluded, untracked and unpriced accounts', () => {
    const views = rows(
      [pm('A', 1000), pm('U', 100, { currency: 'USD' }), pm('X', 9000, { excluded: true }), pm('N', 0, { openingBalance: undefined, openingAt: undefined }), pm('E', 70, { currency: 'EUR' })],
      [pocket('usd', 40, 'U', 'USD')],
    )
    const t = accountTotals(views, 'EGP', convert)
    expect(t.freeInBase).toBe(1000 + 60 * 50)
    expect(t.freeInBase).toBe(sumOfRows(views.filter((v) => v.method.id !== 'E')))
    expect(t.approx).toBe(true)
  })
})
