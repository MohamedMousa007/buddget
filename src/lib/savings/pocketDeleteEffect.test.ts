import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { ledgerOf } from '@/lib/savings/pocketHome'
import { pocketDeleteEffect } from '@/lib/savings/pocketDeleteEffect'
import type { PaymentMethod } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2026-01-01', openingBalance: 1000, openingAt: '2026-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    ...accountsBasisFor(ledgerOf(s), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: s.exchangeRates, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining: 0,
  }).netWorth
}
const seed = (methods: PaymentMethod[]) =>
  useFinanceStore.setState({
    paymentMethods: methods, savingsAccounts: [], savingsTransactions: [], recurringSavingsDeposits: [], incomeEvents: [], incomeSources: [], goals: [], expenses: [], debtPayments: [], debts: [], accountAdjustments: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
    settings: { ...S().settings, baseCurrency: 'EGP' },
  })
const newPocket = (over: Record<string, unknown> = {}) =>
  S().addSavingsAccount({ name: 'Rainy day', category: 'savings', type: 'bank', currency: 'EGP', ...over } as never)
/** The helper's forecast, then the real delete: the net worth the store ends with must be what the copy promised. */
const forecastThenDelete = (id: string) => {
  const effect = pocketDeleteEffect(S(), id)
  const before = netWorth()
  S().deleteSavingsAccount(id)
  return { effect, change: netWorth() - before }
}

describe('pocketDeleteEffect: what the delete warning may promise', () => {
  beforeEach(() => seed([pm('qnb'), pm('cib')]))

  it('a pocket held in an account: the money stays in that account, net worth unchanged', () => {
    const id = newPocket({ openingBalance: 300, heldInPaymentMethodId: 'cib' })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'stays', accountIds: ['cib'] }, change: 0 })
  })

  it('a held pocket that received a transfer from another account: still the holder, net worth unchanged', () => {
    const id = newPocket({ openingBalance: 300, heldInPaymentMethodId: 'cib' })
    S().depositToSavings(id, 200, 'EGP', undefined, { fromAccountId: 'qnb' })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'stays', accountIds: ['cib'] }, change: 0 })
  })

  it('an outside pocket funded from an account: the money is back in that account, net worth unchanged', () => {
    const id = newPocket()
    S().depositToSavings(id, 400, 'EGP', undefined, { fromAccountId: 'qnb' })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'stays', accountIds: ['qnb'] }, change: 0 })
  })

  it('an outside pocket funded from two accounts names both', () => {
    const id = newPocket()
    S().depositToSavings(id, 400, 'EGP', undefined, { fromAccountId: 'qnb' })
    S().depositToSavings(id, 100, 'EGP', undefined, { fromAccountId: 'cib' })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'stays', accountIds: ['qnb', 'cib'] }, change: 0 })
  })

  it('declared outside money: it leaves net worth', () => {
    const id = newPocket({ openingBalance: 700 })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'leaves', amount: 700, currency: 'EGP' }, change: -700 })
  })

  it('part declared, part from an account: only the declared part leaves', () => {
    const id = newPocket({ openingBalance: 700 })
    S().depositToSavings(id, 400, 'EGP', undefined, { fromAccountId: 'qnb' })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'leaves', amount: 700, currency: 'EGP' }, change: -700 })
  })

  it('a pocket held in an account that net worth does not count is counted on its own, so it leaves', () => {
    seed([pm('qnb'), pm('cib', { excluded: true })])
    const id = newPocket({ openingBalance: 300, heldInPaymentMethodId: 'cib' })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'leaves', amount: 300, currency: 'EGP' }, change: -300 })
  })

  it('a declared pocket in another currency: the whole pocket leaves, in its own currency', () => {
    const id = newPocket({ currency: 'USD', openingBalance: 10 })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'leaves', amount: 10, currency: 'USD' }, change: -500 })
  })

  it('no tracked account at all: the pocket is the only place the money is counted', () => {
    seed([pm('qnb', { openingBalance: undefined, openingAt: undefined })])
    const id = newPocket({ openingBalance: 50 })
    expect(forecastThenDelete(id)).toEqual({ effect: { kind: 'leaves', amount: 50, currency: 'EGP' }, change: -50 })
  })
})
