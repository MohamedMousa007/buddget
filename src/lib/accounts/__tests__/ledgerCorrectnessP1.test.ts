import { describe, expect, it } from 'vitest'
import type { Debt, Expense, IncomeEvent, PaymentMethod, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '../balance'
import { accountsBasisFor } from '../netWorthBasis'
import { canHoldParts, isLiveAccount } from '../kinds'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { depositRefusal, pocketHome } from '@/lib/savings/pocketHome'
import { pocketHolderId } from '@/lib/savings/pocketHolder'
import { goalHomeAccounts } from '@/lib/goals/goalPocket'
import { totalDebtRemainingDetail } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * LOGIC_SPEC §6 fixture F (dates moved to 2025 so "now" is after them). Rates USD→EGP 50, gold 24k 4,000 EGP/g.
 * Pocket gold is valued at 24k until P5 (karat per part), so Wedding's 10 g of 21k is stored as 8.75 g (35,000 EGP).
 */
const rates = { USD_EGP: 50, EGP_USD: 0.02 }
const GOLD = 4000
const OPEN = '2025-11-01T00:00:00.000Z'

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', openingAt: OPEN, ...over }) as PaymentMethod
const pocket = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance, createdAt: '2025-11-01', ...over }) as SavingsAccount
const expense = (id: string, amount: number, paymentMethodId: string, date: string, over: Partial<Expense> = {}): Expense =>
  ({ id, amount, currency: 'EGP', category: 'Food', description: id, date, paymentMethodId, isRecurring: false, createdAt: date, ...over }) as Expense
const income = (id: string, amount: number, currency: string, paymentMethodId: string, receivedDate: string): IncomeEvent =>
  ({ id, amount, currency, paymentMethodId, receivedDate, status: 'confirmed', createdAt: receivedDate }) as unknown as IncomeEvent
const debt = (id: string, over: Partial<Debt>): Debt =>
  ({ id, name: id, person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', createdAt: '2025-11-01', ...over }) as Debt

const CARD_DEBT = debt('cardDebt', { debtType: 'credit_card', linkedPaymentMethodId: 'card' })
interface World {
  paymentMethods: PaymentMethod[]
  expenses: Expense[]
  incomeEvents: IncomeEvent[]
  debts: Debt[]
  savingsAccounts: SavingsAccount[]
  savingsTransactions: SavingsTransaction[]
}

function fixtureF(): World {
  return {
    paymentMethods: [
      pm('CIB', { openingBalance: 60000 }),
      pm('Deel', { type: 'wallet', currency: 'USD', openingBalance: 700 }),
      pm('Cash', { type: 'cash', openingBalance: 3000 }),
      pm('NBE', { openingBalance: 0 }),
      pm('card', { type: 'credit_card', parentId: 'CIB', openingAt: undefined }),
    ],
    expenses: [
      expense('debit', 20000, 'CIB', '2025-11-10'),
      expense('cashSpend', 1000, 'Cash', '2025-11-12'),
      expense('cardBuys', 4000, 'card', '2025-11-20'),
      expense('tvBuy', 12000, 'card', '2025-11-12'),
    ],
    incomeEvents: [income('salary', 60000, 'EGP', 'CIB', '2025-11-25'), income('freelance', 300, 'USD', 'Deel', '2025-11-20')],
    debts: [CARD_DEBT],
    savingsAccounts: [
      pocket('carCIB', 20000, { heldInPaymentMethodId: 'CIB' }),
      pocket('carDeel', 200, { currency: 'USD', heldInPaymentMethodId: 'Deel' }),
      pocket('travel', 5000, { heldInPaymentMethodId: 'CIB' }),
      pocket('ms', 3000, { heldInPaymentMethodId: 'CIB' }),
      pocket('wedding', 8.75, { currency: 'XAU' }),
    ],
    savingsTransactions: [],
  }
}

const ledgerOf = (w: World): LedgerInput => ({
  paymentMethods: w.paymentMethods, expenses: w.expenses, incomeEvents: w.incomeEvents, debts: w.debts, debtPayments: [],
  savingsTransactions: w.savingsTransactions, savingsAccounts: w.savingsAccounts, adjustments: [],
  convert: (a, from, to) => tryConvertCurrency(a, from, to, rates),
})

/** Net worth the way useNetWorth builds it: accounts basis + pockets + investments − the debt total the stats report. */
function netWorthOf(w: World) {
  const basis = accountsBasisFor(ledgerOf(w), 'EGP')
  const debtRemaining = totalDebtRemainingDetail(w.debts, [], 'EGP', rates, GOLD, true, w.expenses).total
  return computeNetWorth({
    ...basis, savingsAccounts: w.savingsAccounts, investmentHoldings: [], debts: w.debts,
    settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    exchangeRates: rates, goldPricePerGram: GOLD, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining,
  })
}

const snapshot = (w: World) => {
  const b = computeBalances(ledgerOf(w))
  return {
    balances: Object.fromEntries([...b].map(([id, a]) => [id, a.balance])),
    held: Object.fromEntries([...b].map(([id, a]) => [id, a.held])),
    netWorth: netWorthOf(w).netWorth,
  }
}

/** Two more synthetic QA-style users: one with pocket moves, a debit card and an excluded wallet; one with no tracked account. */
function userTwo(): World {
  return {
    paymentMethods: [
      pm('HSBC', { openingBalance: 40000 }),
      pm('debit', { type: 'debit_card', parentId: 'HSBC', openingAt: undefined }),
      pm('Wallet', { type: 'wallet', openingBalance: 2500, excluded: true }),
    ],
    expenses: [
      expense('groceries', 3000, 'debit', '2025-11-05'),
      expense('topup', 1000, 'HSBC', '2025-11-06', { category: 'Top up', toPaymentMethodId: 'Wallet' }),
    ],
    incomeEvents: [income('pay', 30000, 'EGP', 'HSBC', '2025-11-25')],
    debts: [debt('loan', { debtType: 'personal', startingBalance: 5000 })],
    savingsAccounts: [
      pocket('rainy', 6000, { heldInPaymentMethodId: 'HSBC' }),
      pocket('fun', 800, { heldInPaymentMethodId: 'Wallet' }),
      pocket('stash', 1500),
    ],
    savingsTransactions: [
      { id: 't1', accountId: 'stash', type: 'deposit', amount: 1500, currency: 'EGP', date: '2025-11-07', paymentMethodId: 'HSBC', createdAt: '2025-11-07' } as SavingsTransaction,
      { id: 't2', accountId: 'rainy', type: 'withdrawal', amount: 400, currency: 'EGP', date: '2025-11-08', createdAt: '2025-11-08' } as SavingsTransaction,
    ],
  }
}

function userThree(): World {
  return {
    paymentMethods: [pm('Bank', { openingBalance: undefined, openingAt: undefined })],
    expenses: [expense('rent', 7000, 'Bank', '2025-11-03')],
    incomeEvents: [],
    debts: [],
    savingsAccounts: [pocket('nest', 9000), pocket('usd', 100, { currency: 'USD' })],
    savingsTransactions: [],
  }
}

describe('T0: normal data keeps identical balances, held and net worth (snapshot from before P1)', () => {
  it('fixture F', () => {
    expect(snapshot(fixtureF())).toEqual({
      balances: { CIB: 100000, Deel: 1000, Cash: 2000, NBE: 0 },
      held: { CIB: 28000, Deel: 200, Cash: 0, NBE: 0 },
      netWorth: 171000,
    })
  })
  it('user two: debit card, pocket leg, excluded wallet', () => {
    expect(snapshot(userTwo())).toEqual({
      balances: { HSBC: 64100, Wallet: 3500 },
      held: { HSBC: 6000, Wallet: 800 },
      netWorth: 61400,
    })
  })
  it('user three: no tracked account (assets basis)', () => {
    expect(snapshot(userThree())).toEqual({ balances: {}, held: {}, netWorth: 14000 })
  })
})

describe('I-11 live accounts', () => {
  const methods = fixtureF().paymentMethods
  it('isLiveAccount: tracked, open, present', () => {
    expect(isLiveAccount(methods[0])).toBe(true)
    expect(isLiveAccount(undefined)).toBe(false)
    expect(isLiveAccount({ ...methods[0], closedAt: '2025-11-20T00:00:00Z' })).toBe(false)
    expect(isLiveAccount({ ...methods[0], openingBalance: undefined })).toBe(false)
  })
  it('canHoldParts: live and counted', () => {
    expect(canHoldParts(methods[0])).toBe(true)
    expect(canHoldParts({ ...methods[0], excluded: true })).toBe(false)
    expect(canHoldParts({ ...methods[0], openingBalance: undefined })).toBe(false)
  })
})

describe('rule 0: a label row never moves an account', () => {
  for (const source of ['set_aside', 'opening', 'move_in', 'move_out', 'month_end', 'month_end_undo', 'release', 'spent', 'close']) {
    it(`${source}`, () => {
      const w = fixtureF()
      const type = ['set_aside', 'opening', 'move_in', 'month_end'].includes(source) ? 'deposit' : 'withdrawal'
      // Shapes rules 1, 3 and 8 would book: a leg, a group id, and a cash-flow withdrawal.
      w.savingsTransactions = [
        { id: `${source}1`, accountId: 'travel', type, amount: 700, currency: 'EGP', date: '2025-11-28', source, paymentMethodId: 'NBE', createdAt: '2025-11-28' } as SavingsTransaction,
        { id: `${source}2`, accountId: 'travel', type, amount: 300, currency: 'EGP', date: '2025-11-28', source, transferGroupId: 'g', createdAt: '2025-11-28' } as SavingsTransaction,
        { id: `${source}3`, accountId: 'ms', type, amount: 200, currency: 'EGP', date: '2025-11-28', source, createdAt: '2025-11-28' } as SavingsTransaction,
      ]
      const b = computeBalances(ledgerOf(w))
      expect(b.get('CIB')?.balance).toBe(100000)
      expect(b.get('NBE')?.balance).toBe(0)
    })
  }
})

describe('T2: legacy carry label', () => {
  const world = (carry: Partial<SavingsTransaction>): World => ({
    paymentMethods: [pm('X', { openingBalance: 1000 })], expenses: [], incomeEvents: [], debts: [],
    savingsAccounts: [pocket('part', 300, { heldInPaymentMethodId: 'X' })],
    savingsTransactions: [{ id: 'c', accountId: 'part', type: 'deposit', amount: 300, currency: 'EGP', date: '2025-11-30', source: 'carry', createdAt: '2025-11-30', ...carry } as SavingsTransaction],
  })
  it('before 0356 (key in transfer_group_id) and after (key moved out): balance 1,000, held 300, free 700', () => {
    for (const w of [world({ transferGroupId: 'carry-key' }), world({})]) {
      expect(computeBalances(ledgerOf(w)).get('X')).toMatchObject({ balance: 1000, held: 300, free: 700 })
    }
  })
})

describe('T19: part in a closed account', () => {
  it('counts 0 in net worth and is listed for repair', () => {
    const w = fixtureF()
    w.paymentMethods.push(pm('Old', { openingBalance: 5000, closedAt: '2025-11-15T00:00:00Z' }))
    w.savingsAccounts.push(pocket('legacy', 5000, { heldInPaymentMethodId: 'Old' }))
    const basis = accountsBasisFor(ledgerOf(w), 'EGP')
    expect(netWorthOf(w).netWorth).toBe(171000)
    expect(basis.needsRepair).toEqual(['legacy'])
  })
  it('a part whose account was deleted counts 0 too', () => {
    const w = fixtureF()
    w.savingsAccounts.push(pocket('orphan', 5000, { heldInPaymentMethodId: 'deleted-account' }))
    expect(netWorthOf(w).netWorth).toBe(171000)
    expect(accountsBasisFor(ledgerOf(w), 'EGP').needsRepair).toEqual(['orphan'])
  })
  it('money added to a part whose account is closed or deleted is refused (it would leave net worth)', () => {
    const w = fixtureF()
    w.paymentMethods.push(pm('Old', { openingBalance: 5000, closedAt: '2025-11-15T00:00:00Z' }))
    expect(depositRefusal(ledgerOf(w), { heldInPaymentMethodId: 'Old', currency: 'EGP' }, { amount: 100 })).toBe('over_available')
    expect(depositRefusal(ledgerOf(w), { heldInPaymentMethodId: 'gone', currency: 'EGP' }, { amount: 100 })).toBe('over_available')
  })
  it('a closed account cannot hold a new part', () => {
    const closed = pm('Old', { openingBalance: 5000, closedAt: '2025-11-15T00:00:00Z' })
    expect(pocketHome({ heldInPaymentMethodId: 'Old' }, [closed])).toEqual({ kind: 'outside' })
  })
})

describe('T20: part in an open untracked account', () => {
  const untracked = () => pm('QNB', { openingBalance: undefined, openingAt: undefined })
  it('counts standalone (+4,000) with a "set this account\'s balance" repair', () => {
    const w = fixtureF()
    w.paymentMethods.push(untracked())
    w.savingsAccounts.push(pocket('q', 4000, { heldInPaymentMethodId: 'QNB' }))
    expect(netWorthOf(w).netWorth).toBe(175000)
    expect(accountsBasisFor(ledgerOf(w), 'EGP').needsRepair).toEqual(['q'])
  })
  it('a new part into it is refused (canHoldParts)', () => {
    const methods = [...fixtureF().paymentMethods, untracked()]
    const qnb = methods.find((m) => m.id === 'QNB')!
    expect(pocketHolderId(qnb, methods, 'EGP')).toBeUndefined()
    expect(goalHomeAccounts(methods, 'EGP').map((m) => m.id)).not.toContain('QNB')
    expect(pocketHome({ heldInPaymentMethodId: 'QNB' }, methods)).toEqual({ kind: 'outside' })
  })
  it('once tracked at 4,000: net worth +4,000 once, nothing to repair', () => {
    const w = fixtureF()
    w.paymentMethods.push(pm('QNB', { openingBalance: 4000 }))
    w.savingsAccounts.push(pocket('q', 4000, { heldInPaymentMethodId: 'QNB' }))
    expect(netWorthOf(w).netWorth).toBe(175000)
    expect(accountsBasisFor(ledgerOf(w), 'EGP').needsRepair ?? []).toEqual([])
  })
})
