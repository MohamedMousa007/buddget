import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { computeBalances } from '@/lib/accounts/balance'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { pocketHolderId } from '@/lib/savings/pocketHolder'
import { commitFlowEntities } from '@/lib/budget/studioEntities'
import { answer, createFlow } from '@/lib/budget/flow/flow'
import { trackedMoneyOnHand, knownFromStore } from '@/lib/budget/flow/known'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2026-01-01', openingBalance: 1000, openingAt: '2026-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const ledger = () => {
  const s = S()
  return {
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments, convert: (a: number) => a,
  }
}
const netWorth = () => {
  const s = S()
  return computeNetWorth({
    ...accountsBasisFor(ledger(), 'EGP'), savingsAccounts: s.savingsAccounts, investmentHoldings: [], debts: [], settings: s.settings,
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, monthlyIncome: 0, cashOutflow: 0, debtRemaining: 0,
  }).netWorth
}
const seed = (methods: PaymentMethod[]) =>
  useFinanceStore.setState({
    paymentMethods: methods, savingsAccounts: [], savingsTransactions: [], incomeEvents: [], goals: [], expenses: [], debtPayments: [], debts: [], accountAdjustments: [],
    settings: { ...S().settings, baseCurrency: 'EGP' },
  })
/** The payload PocketFormSheet sends for "from an account you already have". */
const createFromAccount = (method: PaymentMethod, openingBalance: number) =>
  S().addSavingsAccount({
    name: 'Rainy day', category: 'savings', type: 'bank', currency: 'EGP', openingBalance,
    linkedPaymentMethodId: method.id, heldInPaymentMethodId: pocketHolderId(method, S().paymentMethods, 'EGP'),
  } as never)

describe('QA-13 / QA-122 / QA-12: money a tracked account already holds is never counted twice', () => {
  beforeEach(() => seed([pm('qnb')]))

  it('a pocket created from a tracked account is an earmark: net worth unchanged, free shrinks, set aside shows it', () => {
    expect(netWorth()).toBe(1000)
    createFromAccount(S().paymentMethods[0], 100)
    expect(S().savingsAccounts[0].heldInPaymentMethodId).toBe('qnb')
    expect(netWorth()).toBe(1000)
    expect(computeBalances(ledger()).get('qnb')).toMatchObject({ balance: 1000, held: 100, free: 900 })
  })

  it('a debit card earmarks inside its parent account; an untracked or other-currency account holds nothing', () => {
    const methods = [pm('qnb'), pm('card', { type: 'debit_card', parentId: 'qnb', openingBalance: undefined, openingAt: undefined }), pm('new', { openingBalance: undefined, openingAt: undefined })]
    expect(pocketHolderId(methods[1], methods, 'EGP')).toBe('qnb')
    expect(pocketHolderId(methods[2], methods, 'EGP')).toBeUndefined()
    expect(pocketHolderId(methods[0], methods, 'USD')).toBeUndefined()
  })

  it('gap (a): a deposit into a held pocket from another account moves the money to the holder, not out of net worth', () => {
    seed([pm('qnb'), pm('cib')])
    createFromAccount(S().paymentMethods[0], 100)
    S().depositToSavings(S().savingsAccounts[0].id, 300, 'EGP', undefined, { fromAccountId: 'cib' })
    const b = computeBalances(ledger())
    expect(b.get('cib')!.balance).toBe(700)
    expect(b.get('qnb')).toMatchObject({ balance: 1300, held: 400, free: 900 })
    expect(netWorth()).toBe(2000)
  })

  it('gap (b): a pocket held in a not-counted account is counted on its own, as zakat does', () => {
    seed([pm('qnb', { excluded: true }), pm('cib')])
    useFinanceStore.setState({ savingsAccounts: [{ id: 'p', name: 'p', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 100, heldInPaymentMethodId: 'qnb', createdAt: '2026-01-01' } as SavingsAccount] })
    expect(netWorth()).toBe(1100)
  })

  it('Budget Studio: with tracked accounts the question is already answered from the balance sheet and no pocket is created', () => {
    createFromAccount(S().paymentMethods[0], 100)
    useFinanceStore.setState({ savingsAccounts: [...S().savingsAccounts, { id: 'out', name: 'Safe', category: 'savings', type: 'cash', currency: 'EGP', currentBalance: 50, createdAt: '2026-01-01' } as SavingsAccount] })
    expect(trackedMoneyOnHand(S())).toBe(1050)
    expect(knownFromStore({ liquidSavings: 150, bills: [], debts: [], goals: [], dependents: 0 } as never, null, 1050).savingsOnHand).toBe(1050)
    seed([pm('qnb')])
    const add = vi.fn(() => 'pocket-1')
    const store = { ...S(), addSavingsAccount: add }
    const created = commitFlowEntities(answer(createFlow('mixed'), 'savingsOnHand', 1400), store as never, 'EGP', { income: 'i', savings: 's', debt: () => 'd', goal: () => 'g' })
    expect(add).not.toHaveBeenCalled()
    expect(created.savings).toBeUndefined()
    expect(netWorth()).toBe(1000)
  })

  it('no tracked account: nothing is known up front and the studio still creates the pocket', () => {
    seed([pm('qnb', { openingBalance: undefined, openingAt: undefined })])
    expect(trackedMoneyOnHand(S())).toBeUndefined()
  })
})
