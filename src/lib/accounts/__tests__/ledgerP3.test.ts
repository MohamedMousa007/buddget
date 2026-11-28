import { describe, expect, it } from 'vitest'
import type { Debt, DebtPayment, Expense, IncomeEvent, PaymentMethod, RecurringDebtPayment, SavingsAccount, SavingsTransaction } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '../balance'
import { accountsBasisFor } from '../netWorthBasis'
import { accountTotals } from '../useAccounts'
import { asksPaysFrom, paysFrom } from '../cardHold'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { cardOwed, cardUnbilledPlans, computeCreditCardOutstanding } from '@/lib/debt/computeCreditCardBalance'
import { isCardPlan, isSettlementPlan } from '@/lib/debt/bnpl'
import { availableIn } from '@/lib/savings/pocketHome'
import { confirmRecurringDebtPayment } from '@/lib/debts/recurringDebtDueHandlers'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateCashOutflow, totalDebtRemainingDetail, totalDebtRemainingInBase } from '@/lib/utils/calculations'
import { bookCardPlanPurchase, cardPlanPurchaseId } from '@/lib/debts/cardPlanPurchase'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * LOGIC_SPEC §6, P3 rows (T1, T3, T7, T8, T9, T25, N6, N8) on fixture F (dates in 2025, as in P1/P2). The hold-back
 * depends on the card's next statement close, so every balance is read at an explicit instant (local time).
 * CIB Card closes on the 10th; the TV plan is 6 × 2,000 with its first bill on Dec 10.
 */
const RATES = { USD_EGP: 50, EGP_USD: 0.02 }
const GOLD = 4000
const OPEN = '2025-11-01T00:00:00.000Z'
const at = (month: number, day: number) => new Date(2025, month - 1, day, 18).getTime()
const NOV30 = at(11, 30)

const pm = (id: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type: 'bank_account', currency: 'EGP', isDefault: false, createdAt: '2025-11-01', openingAt: OPEN, ...over }) as PaymentMethod
const part = (id: string, currentBalance: number, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'vault', currency: 'EGP', currentBalance, createdAt: '2025-11-01', ...over }) as SavingsAccount
const expense = (id: string, amount: number, paymentMethodId: string, date: string, over: Partial<Expense> = {}): Expense =>
  ({ id, amount, currency: 'EGP', category: 'Food', description: id, date, paymentMethodId, isRecurring: false, createdAt: date, ...over }) as Expense
const income = (id: string, amount: number, currency: string, paymentMethodId: string, receivedDate: string): IncomeEvent =>
  ({ id, amount, currency, paymentMethodId, receivedDate, status: 'confirmed', createdAt: receivedDate }) as unknown as IncomeEvent
const debt = (id: string, over: Partial<Debt>): Debt =>
  ({ id, name: id, person: '', startingBalance: 0, currency: 'EGP', isGold: false, direction: 'i_owe', status: 'active', createdAt: '2025-11-01', ...over }) as Debt
const payment = (id: string, debtId: string, amountPaid: number, paymentMethodId: string, date: string, over: Partial<DebtPayment> = {}): DebtPayment =>
  ({ id, debtId, amountPaid, paymentMethodId, date, createdAt: date, ...over }) as DebtPayment

const CARD = debt('cardDebt', { debtType: 'credit_card', linkedPaymentMethodId: 'card', paymentDueDay: 10 })
const TV = debt('tv', {
  name: 'TV', person: 'Installment', debtType: 'installment', startingBalance: 12000, installmentCount: 6, installmentAmount: 2000,
  installmentFrequency: 'monthly', startDate: '2025-12-10', installmentProvider: 'credit_card', linkedCreditCardDebtId: 'cardDebt',
  createdAt: '2025-11-12', // bought on the card that day (tvBuy)
})

interface World {
  paymentMethods: PaymentMethod[]
  expenses: Expense[]
  incomeEvents: IncomeEvent[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  savingsAccounts: SavingsAccount[]
  savingsTransactions: SavingsTransaction[]
}

function fixtureF(over: Partial<World> = {}): World {
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
    debts: [CARD, TV],
    debtPayments: [],
    savingsAccounts: [
      part('carCIB', 20000, { heldInPaymentMethodId: 'CIB', goalId: 'car' }),
      part('carDeel', 200, { currency: 'USD', heldInPaymentMethodId: 'Deel', goalId: 'car' }),
      part('travel', 5000, { heldInPaymentMethodId: 'CIB' }),
      part('ms', 3000, { heldInPaymentMethodId: 'CIB', isMonthlySavings: true }),
      part('wedding', 8.75, { currency: 'XAU', goalId: 'wedding' }),
    ],
    savingsTransactions: [],
    ...over,
  }
}

const ledgerOf = (w: World, rates: Record<string, number> = RATES): LedgerInput => ({
  ...w, adjustments: [], convert: (a, from, to) => tryConvertCurrency(a, from, to, rates),
})
const balancesAt = (w: World, asOf: number) => computeBalances(ledgerOf(w), asOf)
const pick = (w: World, id: string, asOf: number) => {
  const b = balancesAt(w, asOf).get(id)!
  return { balance: b.balance, held: b.held, cardHold: b.cardHold, free: b.free }
}
const freeTotal = (w: World, asOf: number) => {
  const balances = balancesAt(w, asOf)
  const views = w.paymentMethods.map((method) => ({ method, balance: balances.get(method.id) ?? null }))
  return accountTotals(views, 'EGP', (a, from, to) => tryConvertCurrency(a, from, to, RATES))
}

/** Net worth the way useNetWorth builds it: the stats debt total, which counts a card plan once, inside the card. */
function netWorthOf(w: World, rates: Record<string, number> = RATES) {
  const basis = accountsBasisFor(ledgerOf(w, rates), 'EGP')
  const debtRemaining = totalDebtRemainingDetail(w.debts, w.debtPayments, 'EGP', rates, GOLD, true, w.expenses).total
  return computeNetWorth({
    ...basis, savingsAccounts: w.savingsAccounts, investmentHoldings: [], debts: w.debts,
    settings: { baseCurrency: 'EGP', secondaryCurrency: null, showSecondaryCurrency: false } as never,
    exchangeRates: rates, goldPricePerGram: GOLD, goldPriceAvailable: true, lookup: (() => null) as never, debtRemaining,
  })
}
const owedAt = (w: World, asOf: number, rates: Record<string, number> = RATES) => {
  const rows = { expenses: w.expenses, payments: w.debtPayments.filter((p) => new Date(`${p.date}T12:00:00`).getTime() <= asOf), debts: w.debts }
  const convert = (a: number, from: string, to: string) => tryConvertCurrency(a, from, to, rates)
  return { owed: cardOwed(CARD, rows, convert), unbilled: cardUnbilledPlans(CARD, rows, convert, new Date(asOf)) }
}

describe('T7: hold-back', () => {
  it('F: cardHold 6,000 on CIB; free(CIB) 66,000; freeTotal 108,000', () => {
    const w = fixtureF()
    expect(pick(w, 'CIB', NOV30)).toEqual({ balance: 100000, held: 28000, cardHold: 6000, free: 66000 })
    expect(owedAt(w, NOV30)).toEqual({ owed: 16000, unbilled: 10000 })
    expect(pick(w, 'Deel', NOV30)).toMatchObject({ balance: 1000, held: 200, cardHold: 0, free: 800 })
    expect(freeTotal(w, NOV30).freeInBase).toBe(108000)
    expect(netWorthOf(w).netWorth).toBe(171000)
  })
})

describe('T1: free is not clamped', () => {
  it('CIB debit −80,000 on Dec 1', () => {
    const w = fixtureF()
    w.expenses.push(expense('big', 80000, 'CIB', '2025-12-01'))
    const dec1 = at(12, 1)
    expect(pick(w, 'CIB', dec1)).toEqual({ balance: 20000, held: 28000, cardHold: 6000, free: -14000 })
    const t = freeTotal(w, dec1)
    expect(t.freeInBase).toBe(28000)
    expect(t.totalInBase).toBe(72000)
    expect(netWorthOf(w).netWorth).toBe(91000)
    // Caps never go below 0: nothing can be set aside or moved out of CIB.
    expect(availableIn('CIB', { ...ledgerOf(w) })).toBe(0)
  })
})

describe('T8: bill paid from the parent account', () => {
  it('Dec 15: 6,000 from CIB to the card', () => {
    const w = fixtureF({ debtPayments: [payment('bill', 'cardDebt', 6000, 'CIB', '2025-12-15')] })
    const dec15 = at(12, 15)
    expect(owedAt(w, dec15)).toEqual({ owed: 10000, unbilled: 8000 })
    expect(pick(w, 'CIB', dec15)).toEqual({ balance: 94000, held: 28000, cardHold: 2000, free: 64000 })
    expect(netWorthOf(w).netWorth).toBe(171000)
    // A payment to the card is no expense: spending is unchanged.
    expect(w.expenses).toHaveLength(4)
  })
})

describe('N6: bill paid from another account', () => {
  it('Dec 15: statement 6,000 paid from Deel $120 (booked 6,000); the hold stays on CIB', () => {
    const w = fixtureF({
      debtPayments: [payment('bill', 'cardDebt', 6000, 'Deel', '2025-12-15', { paymentCurrency: 'USD', originalAmount: 120 })],
    })
    const dec15 = at(12, 15)
    expect(owedAt(w, dec15)).toEqual({ owed: 10000, unbilled: 8000 })
    expect(pick(w, 'Deel', dec15)).toEqual({ balance: 880, held: 200, cardHold: 0, free: 680 })
    expect(pick(w, 'CIB', dec15)).toEqual({ balance: 100000, held: 28000, cardHold: 2000, free: 70000 })
    expect(netWorthOf(w).netWorth).toBe(171000)
    expect(owedAt(w, dec15, { USD_EGP: 45, EGP_USD: 1 / 45 }).owed).toBe(10000)
  })
})

describe('N8: plan paid off early', () => {
  it('Dec 1: TV plan 12,000 from CIB (a new Installment row): hold 4,000, free(CIB) 56,000', () => {
    const w = fixtureF({
      debts: [CARD, { ...TV, status: 'cleared' }],
      debtPayments: [payment('early', 'tv', 12000, 'CIB', '2025-12-01')],
    })
    w.expenses.push(expense('earlyExp', 12000, 'CIB', '2025-12-01', { category: 'Installment', linkedDebtId: 'tv', isDebtPayment: true, linkedDebtPaymentId: 'early' }))
    const dec1 = at(12, 1)
    expect(owedAt(w, dec1)).toEqual({ owed: 4000, unbilled: 0 })
    expect(pick(w, 'CIB', dec1)).toEqual({ balance: 88000, held: 28000, cardHold: 4000, free: 56000 })
    expect(netWorthOf(w).netWorth).toBe(171000)
  })
})

describe('T9: no linked account', () => {
  it('card with no parent and no pays-from, last paid from NBE: the hold lands on NBE', () => {
    const w = fixtureF({
      debts: [{ ...CARD, startingBalance: 1000 }, TV],
      // Paid before NBE's opening balance, so NBE stays 0 and owed stays 16,000.
      debtPayments: [payment('old', 'cardDebt', 1000, 'NBE', '2025-10-20')],
    })
    w.paymentMethods = w.paymentMethods.map((m) => (m.id === 'card' ? { ...m, parentId: undefined } : m))
    expect(paysFrom(w.debts[0], ledgerOf(w))).toBe('NBE')
    expect(pick(w, 'NBE', NOV30)).toEqual({ balance: 0, held: 0, cardHold: 6000, free: -6000 })
    expect(pick(w, 'CIB', NOV30)).toMatchObject({ cardHold: 0, free: 72000 })
  })
  it('pays-from wins over the last payer; with neither, the primary account in the card currency', () => {
    const w = fixtureF({ debtPayments: [payment('old', 'cardDebt', 1000, 'NBE', '2025-10-20')] })
    const noParent = w.paymentMethods.map((m) => (m.id === 'card' ? { ...m, parentId: undefined } : m))
    expect(paysFrom(CARD, { ...ledgerOf(w), paymentMethods: noParent.map((m) => (m.id === 'card' ? { ...m, paysFromPaymentMethodId: 'Cash' } : m)) })).toBe('Cash')
    expect(paysFrom(CARD, { ...ledgerOf(w), paymentMethods: noParent, debtPayments: [] })).toBe('CIB')
  })
  it('a card under an untracked account never loses its hold: the next live payer in the chain carries it', () => {
    const w = fixtureF()
    w.paymentMethods = w.paymentMethods.map((m) => (m.id === 'CIB' ? { ...m, openingBalance: undefined, openingAt: undefined } : m))
    const payer = paysFrom(CARD, ledgerOf(w))
    expect(payer).not.toBe('CIB')
    expect(payer).toBeTruthy()
    expect(balancesAt(w, NOV30).get(payer!)?.cardHold).toBe(6000)
  })
  it('Add card asks "pays this card from" only for a credit card with no linked account', () => {
    expect(asksPaysFrom({ type: 'credit_card', parentId: undefined })).toBe(true)
    expect(asksPaysFrom({ type: 'credit_card', parentId: 'CIB' })).toBe(false)
    expect(asksPaysFrom({ type: 'debit_card', parentId: undefined })).toBe(false)
  })
})

describe('T3: a card plan is owed once, inside the card', () => {
  it('F + the plan as a separate debt: NW 171,000 (not 159,000); the debt totals agree at 16,000', () => {
    const w = fixtureF()
    expect(totalDebtRemainingDetail(w.debts, [], 'EGP', RATES, GOLD, true, w.expenses).total).toBe(16000)
    expect(netWorthOf(w)).toMatchObject({ netWorth: 171000, totalDebt: 16000 })
  })
  it('the Cards total (cards only, plans from the full list) counts a plan payment from CIB once', () => {
    const w = fixtureF({ debtPayments: [payment('p', 'tv', 2000, 'CIB', '2025-11-28')] })
    const cards = w.debts.filter((d) => d.debtType === 'credit_card')
    expect(totalDebtRemainingInBase(cards, w.debtPayments, 'EGP', RATES, GOLD, true, w.expenses, w.debts)).toBe(14000)
    expect(totalDebtRemainingDetail(w.debts, w.debtPayments, 'EGP', RATES, GOLD, true, w.expenses).total).toBe(14000)
  })
  it('a linked plan with no purchase charge on the card is owed once, on its own (never zero times)', () => {
    const w = fixtureF({ debtPayments: [payment('p', 'tv', 2000, 'CIB', '2025-11-28')] })
    w.expenses = w.expenses.filter((e) => e.id !== 'tvBuy')
    w.expenses.push(expense('pExp', 2000, 'CIB', '2025-11-28', { category: 'Installment', linkedDebtId: 'tv', isDebtPayment: true, linkedDebtPaymentId: 'p' }))
    expect(computeCreditCardOutstanding(CARD, w.expenses, w.debtPayments, RATES, w.debts)).toBe(4000)
    expect(totalDebtRemainingDetail(w.debts, w.debtPayments, 'EGP', RATES, GOLD, true, w.expenses).total).toBe(14000)
    expect(netWorthOf(w).totalDebt).toBe(14000)
    // A card with no method of its own can carry no purchase: its plan is owed on its own too.
    const noPm = { ...CARD, linkedPaymentMethodId: undefined }
    expect(totalDebtRemainingDetail([noPm, TV], [], 'EGP', RATES, GOLD, true, fixtureF().expenses).total).toBe(12000)
  })
  it('a plan whose card is gone from the list is still owed on its own', () => {
    const w = fixtureF({ debts: [TV] })
    expect(netWorthOf(w).totalDebt).toBe(12000)
  })
  it('a legacy Debt instalment charged on the card leaves what the card owes unchanged', () => {
    const w = fixtureF({ debtPayments: [payment('tick', 'tv', 2000, 'card', '2025-12-10')] })
    w.expenses.push(expense('tickExp', 2000, 'card', '2025-12-10', { category: 'Debt', linkedDebtId: 'tv', isDebtPayment: true, linkedDebtPaymentId: 'tick' }))
    expect(computeCreditCardOutstanding(CARD, w.expenses, w.debtPayments, RATES, w.debts)).toBe(16000)
    expect(netWorthOf(w).netWorth).toBe(171000)
  })
  it('a legacy Debt instalment paid from CIB pays the card down and counts once', () => {
    const w = fixtureF({ debtPayments: [payment('p', 'tv', 2000, 'CIB', '2025-11-28')] })
    w.expenses.push(expense('pExp', 2000, 'CIB', '2025-11-28', { category: 'Debt', linkedDebtId: 'tv', isDebtPayment: true, linkedDebtPaymentId: 'p' }))
    expect(computeCreditCardOutstanding(CARD, w.expenses, w.debtPayments, RATES, w.debts)).toBe(14000)
    expect(netWorthOf(w).netWorth).toBe(171000)
  })
})

describe('T25: instalments written after the cutover are settlements', () => {
  const base = () => useFinanceStore.getState().settings.baseCurrency
  const sched = (over: Partial<RecurringDebtPayment>): RecurringDebtPayment =>
    ({ id: 'sch', debtId: 'tv', amount: 2000, currency: base(), paymentMethodId: 'card', frequency: 'monthly', nextDueDate: '2025-12-10', isActive: true, createdAt: '2025-11-12', ...over })
  const seed = (s: RecurringDebtPayment, extra: Partial<World> = {}) => {
    const w = fixtureF(extra)
    useFinanceStore.setState({
      paymentMethods: [...w.paymentMethods, pm('tabby', { type: 'bnpl', openingAt: undefined })],
      debts: w.debts.map((d) => ({ ...d, currency: base() })), recurringDebtPayments: [s],
      debtPayments: [], expenses: w.expenses.map((e) => ({ ...e, currency: base() })), goals: [], exchangeRates: RATES,
    })
  }

  it('isCardPlan / isSettlementPlan', () => {
    const pms = [pm('tabby', { type: 'bnpl' })]
    expect(isCardPlan(TV)).toBe(true)
    expect(isCardPlan({ ...TV, linkedCreditCardDebtId: undefined })).toBe(false)
    expect(isSettlementPlan(TV, pms)).toBe(true)
    expect(isSettlementPlan({ ...TV, linkedCreditCardDebtId: undefined, linkedPaymentMethodId: 'tabby' }, pms)).toBe(true)
    expect(isSettlementPlan({ ...TV, linkedCreditCardDebtId: undefined, installmentProvider: 'bank' as never }, pms)).toBe(false)
  })

  it('a card-plan instalment on the card is an Installment row and leaves the card owed unchanged', () => {
    seed(sched({}))
    expect(confirmRecurringDebtPayment('sch')).toBe(true)
    const s = useFinanceStore.getState()
    const row = s.expenses.find((e) => e.linkedDebtId === 'tv')!
    expect(row.category).toBe('Installment')
    expect(computeCreditCardOutstanding(s.debts[0], s.expenses, s.debtPayments, RATES, s.debts)).toBe(16000)
    // The card bill is the cash leaving; the tick itself is not cash out.
    expect(calculateCashOutflow({ monthExpenses: s.expenses.filter((e) => e.id === row.id), monthDebtPayments: s.debtPayments, debts: s.debts, monthSavingsDeposits: 0, baseCurrency: base(), exchangeRates: RATES })).toBe(0)
  })

  it('a schedule that names no account ticks on the card', () => {
    seed(sched({ paymentMethodId: '' }))
    expect(confirmRecurringDebtPayment('sch')).toBe(true)
    const s = useFinanceStore.getState()
    const row = s.expenses.find((e) => e.linkedDebtId === 'tv' && e.isDebtPayment)!
    expect([row.category, row.paymentMethodId]).toEqual(['Installment', 'card'])
    expect(computeCreditCardOutstanding(s.debts[0], s.expenses, s.debtPayments, RATES, s.debts)).toBe(16000)
  })
  it('a schedule set to pay from CIB keeps moving CIB: an Installment row that pays the card down', () => {
    seed(sched({ paymentMethodId: 'CIB' }))
    expect(confirmRecurringDebtPayment('sch')).toBe(true)
    const s = useFinanceStore.getState()
    const row = s.expenses.find((e) => e.linkedDebtId === 'tv' && e.isDebtPayment)!
    expect([row.category, row.paymentMethodId]).toEqual(['Installment', 'CIB'])
    expect(computeCreditCardOutstanding(s.debts[0], s.expenses, s.debtPayments, RATES, s.debts)).toBe(14000)
  })

  it('a bank plan (not on a card) keeps Debt spend; pre-cutover rows are not rewritten', () => {
    const legacy = expense('legacyTick', 2000, 'card', '2025-11-10', { category: 'Debt', linkedDebtId: 'tv', isDebtPayment: true })
    seed(sched({ debtId: 'bank', paymentMethodId: 'CIB' }), { expenses: [...fixtureF().expenses, legacy] })
    useFinanceStore.setState((s) => ({ debts: [...s.debts, debt('bank', { debtType: 'installment', currency: base(), startingBalance: 6000, installmentCount: 3, installmentAmount: 2000, installmentProvider: 'bank' as never })] }))
    expect(confirmRecurringDebtPayment('sch')).toBe(true)
    const s = useFinanceStore.getState()
    expect(s.expenses.find((e) => e.linkedDebtId === 'bank')!.category).toBe('Debt')
    expect(s.expenses.find((e) => e.id === 'legacyTick')!.category).toBe('Debt')
  })
})

describe('regression: no cards and no card plans = the numbers from before P3', () => {
  it('balances, held, free and net worth match the pre-P3 snapshot', () => {
    const w: World = {
      paymentMethods: [
        pm('HSBC', { openingBalance: 40000 }),
        pm('debit', { type: 'debit_card', parentId: 'HSBC', openingAt: undefined }),
        pm('Wallet', { type: 'wallet', openingBalance: 2500, excluded: true }),
      ],
      expenses: [expense('groceries', 3000, 'debit', '2025-11-05'), expense('topup', 1000, 'HSBC', '2025-11-06', { category: 'Top up', toPaymentMethodId: 'Wallet' })],
      incomeEvents: [income('pay', 30000, 'EGP', 'HSBC', '2025-11-25')],
      debts: [
        debt('loan', { debtType: 'personal', startingBalance: 5000 }),
        debt('bank', { debtType: 'installment', startingBalance: 9000, installmentCount: 9, installmentAmount: 1000, installmentProvider: 'bank' as never }),
      ],
      debtPayments: [],
      savingsAccounts: [part('rainy', 6000, { heldInPaymentMethodId: 'HSBC' }), part('fun', 800, { heldInPaymentMethodId: 'Wallet' }), part('stash', 1500)],
      savingsTransactions: [
        { id: 't1', accountId: 'stash', type: 'deposit', amount: 1500, currency: 'EGP', date: '2025-11-07', paymentMethodId: 'HSBC', createdAt: '2025-11-07' } as SavingsTransaction,
        { id: 't2', accountId: 'rainy', type: 'withdrawal', amount: 400, currency: 'EGP', date: '2025-11-08', createdAt: '2025-11-08' } as SavingsTransaction,
      ],
    }
    const b = computeBalances(ledgerOf(w))
    expect(Object.fromEntries([...b].map(([id, a]) => [id, [a.balance, a.held, a.free, a.cardHold]]))).toEqual({
      HSBC: [64100, 6000, 58100, 0], Wallet: [3500, 800, 2700, 0],
    })
    expect(netWorthOf(w)).toMatchObject({ netWorth: 52400, totalDebt: 14000 })
  })
})

describe('§4.10: a new card plan books its purchase on the card', () => {
  const seed = (expenses: Expense[] = []) => {
    const w = fixtureF()
    useFinanceStore.setState({
      paymentMethods: w.paymentMethods, debts: [CARD, TV], debtPayments: [], goals: [], exchangeRates: RATES,
      expenses: [...w.expenses.filter((e) => e.id !== 'tvBuy'), ...expenses],
      settings: { ...useFinanceStore.getState().settings, baseCurrency: 'EGP' },
    })
  }
  const S = () => useFinanceStore.getState()

  it('writes one full-price spend charge on the card, id from the plan; a retry writes nothing', () => {
    seed()
    expect(bookCardPlanPurchase('tv', '2025-11-12')).toBe(cardPlanPurchaseId('tv'))
    expect(bookCardPlanPurchase('tv', '2025-11-12')).toBeNull()
    const rows = S().expenses.filter((e) => e.linkedDebtId === 'tv')
    expect(rows.map((e) => [e.id, e.amount, e.paymentMethodId, e.category, !!e.isDebtPayment])).toEqual([[cardPlanPurchaseId('tv'), 12000, 'card', 'Shopping', false]])
    const w = fixtureF({ expenses: S().expenses })
    expect(computeCreditCardOutstanding(CARD, w.expenses, [], RATES, w.debts)).toBe(16000)
    expect(netWorthOf(w).netWorth).toBe(171000)
  })
  it('links a matching charge already on the card instead of writing a second one', () => {
    seed([expense('smsBuy', 12000, 'card', '2025-11-11')])
    expect(bookCardPlanPurchase('tv', '2025-11-12')).toBeNull()
    expect(S().expenses.filter((e) => e.amount === 12000).map((e) => [e.id, e.linkedDebtId])).toEqual([['smsBuy', 'tv']])
  })
  it('a plan not on a card books nothing', () => {
    seed()
    useFinanceStore.setState((st) => ({ debts: [...st.debts, debt('bank', { debtType: 'installment', startingBalance: 6000 })] }))
    expect(bookCardPlanPurchase('bank', '2025-11-12')).toBeNull()
  })
})

describe('§4.1: a hold with no rate to the account is 0 and approximate', () => {
  it('USD card paid from CIB with no USD→EGP rate', () => {
    const w = fixtureF({ debts: [{ ...CARD, currency: 'USD' }] })
    w.expenses = w.expenses.filter((e) => e.paymentMethodId !== 'card').concat(expense('usdBuy', 100, 'card', '2025-11-20', { currency: 'USD' }))
    const b = computeBalances({ ...ledgerOf(w), convert: (a, from, to) => (from === to ? a : null) }, NOV30).get('CIB')!
    expect([b.cardHold, b.free, b.approx]).toEqual([0, 72000, true])
  })
})
