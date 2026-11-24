import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { computeBalances } from '@/lib/accounts/balance'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { pocketHolderId } from '@/lib/savings/pocketHolder'
import { commitFlowEntities } from '@/lib/budget/studioEntities'
import { answer, createFlow } from '@/lib/budget/flow/flow'
import { knownFromStore } from '@/lib/budget/flow/known'
import { NODE_BY_ID } from '@/lib/budget/flow/nodes'
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
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining: 0,
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

  describe('Budget Studio with tracked accounts: the user says where the saved money is', () => {
    const facts = (liquidSavings: number) => ({ liquidSavings, bills: [], debts: [], goals: [], dependents: 0 }) as never
    const names = { income: 'i', savings: 's', debt: () => 'd', goal: () => 'g' }
    const commit = (inTracked?: boolean) => {
      const add = vi.fn(() => 'pocket-1')
      let flow = answer(createFlow('mixed', { tracksAccounts: true }), 'savingsOnHand', 1400)
      if (inTracked !== undefined) flow = answer(flow, 'savingsInTracked', inTracked)
      return { add, created: commitFlowEntities(flow, { ...S(), addSavingsAccount: add } as never, 'EGP', names) }
    }

    it('asks the amount instead of assuming the account balances, even when an old answer is remembered', () => {
      const known = knownFromStore(facts(0), { budgetProfile: { savingsOnHand: 900, savingsInTracked: true } } as never, true)
      expect(known.savingsOnHand).toBeUndefined()
      expect(known.savingsInTracked).toBeUndefined()
      expect(known.tracksAccounts).toBe(true)
    })

    it('existing pockets still answer it, and without tracked accounts nothing changes', () => {
      expect(knownFromStore(facts(150), null, true).savingsOnHand).toBe(150)
      expect(knownFromStore(facts(0), { budgetProfile: { savingsOnHand: 900 } } as never, false).savingsOnHand).toBe(900)
    })

    it('asks where it is only after an amount, and only with tracked accounts', () => {
      const where = NODE_BY_ID.get('savingsInTracked')!
      expect(where.when!(answer(createFlow('mixed', { tracksAccounts: true }), 'savingsOnHand', 1400))).toBe(true)
      expect(where.when!(answer(createFlow('mixed', { tracksAccounts: true }), 'savingsOnHand', 0))).toBe(false)
      expect(where.when!(answer(createFlow('mixed'), 'savingsOnHand', 1400))).toBe(false)
    })

    it('inside a tracked account: an earmarked pocket in that account, and net worth does not move', () => {
      const flow = answer(answer(createFlow('mixed', { tracksAccounts: true }), 'savingsOnHand', 400), 'savingsInTracked', true)
      const created = commitFlowEntities(flow, S() as never, 'EGP', names)
      expect(S().savingsAccounts.find((p) => p.id === created.savings)).toMatchObject({ heldInPaymentMethodId: 'qnb', currentBalance: 400 })
      expect(computeBalances(ledger()).get('qnb')).toMatchObject({ balance: 1000, held: 400, free: 600 })
      expect(netWorth()).toBe(1000)
    })

    it('goes into the account with the most free money and never above what is free there', () => {
      seed([pm('qnb'), pm('cib', { openingBalance: 3000 }), pm('usd', { currency: 'USD', openingBalance: 9000 })])
      const flow = answer(answer(createFlow('mixed', { tracksAccounts: true }), 'savingsOnHand', 5000), 'savingsInTracked', true)
      const created = commitFlowEntities(flow, S() as never, 'EGP', names)
      expect(S().savingsAccounts.find((p) => p.id === created.savings)).toMatchObject({ heldInPaymentMethodId: 'cib', currentBalance: 3000 })
      expect(netWorth()).toBe(13000)
    })

    it('nothing free in any account: nothing is created', () => {
      seed([pm('qnb', { openingBalance: 0 })])
      expect(commit(true).add).not.toHaveBeenCalled()
    })

    it('kept outside: a pocket of its own is created', () => {
      const { add, created } = commit(false)
      expect(add).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 1400 }))
      expect(add.mock.calls[0]).not.toEqual([expect.objectContaining({ heldInPaymentMethodId: expect.anything() })])
      expect(created.savings).toBe('pocket-1')
    })

    it('not answered: nothing is created (the safe side of a double count)', () => {
      expect(commit().add).not.toHaveBeenCalled()
    })
  })
})
