import { describe, expect, it } from 'vitest'
import type { Expense, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '../balance'
import { detectGap } from '../gap'
import { resolveAccountId } from '../resolve'

const OPEN = '2026-10-01T00:00:00.000Z'
const pm = (o: Partial<PaymentMethod> & Pick<PaymentMethod, 'id' | 'type'>): PaymentMethod =>
  ({ name: o.id, currency: 'EGP', isDefault: false, createdAt: '2026-01-01T00:00:00Z', ...o }) as PaymentMethod
const bank = pm({ id: 'bank', type: 'bank_account', openingBalance: 1000, openingAt: OPEN })
const cash = pm({ id: 'cash', type: 'cash', openingBalance: 200, openingAt: OPEN })
const debit = pm({ id: 'debit', type: 'debit_card', parentId: 'bank' })
const credit = pm({ id: 'credit', type: 'credit_card', parentId: 'bank' })
const exp = (o: Partial<Expense> & Pick<Expense, 'id' | 'amount' | 'paymentMethodId'>): Expense =>
  ({ date: '2026-10-05', description: 'x', category: 'Food', currency: 'EGP', amountInBaseCurrency: o.amount, isRecurring: false, createdAt: '', updatedAt: '', ...o }) as Expense
const base = (o: Partial<LedgerInput> = {}): LedgerInput => ({
  paymentMethods: [bank, cash, debit, credit], expenses: [], incomeEvents: [], debtPayments: [],
  savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a) => a, ...o,
})
const bal = (i: LedgerInput, id: string, asOf?: number) => computeBalances(i, asOf).get(id)

describe('resolveAccountId', () => {
  it('debit draws on its parent, credit and untracked debit move nothing, sentinel/null is cash', () => {
    const pms = [bank, cash, debit, credit, pm({ id: 'orphan', type: 'debit_card' })]
    expect(resolveAccountId('debit', pms)).toBe('bank')
    expect(resolveAccountId('credit', pms)).toBeNull()
    expect(resolveAccountId('orphan', pms)).toBeNull()
    expect(resolveAccountId('pm_default_cash', pms)).toBe('cash')
    expect(resolveAccountId(undefined, pms)).toBe('cash')
  })
  it('never uses is_default to pick Cash', () => {
    const pms = [pm({ id: 'card', type: 'credit_card', isDefault: true }), pm({ id: 'c2', type: 'cash', createdAt: '2026-03-01' }), pm({ id: 'c1', type: 'cash', createdAt: '2026-02-01' })]
    expect(resolveAccountId(null, pms)).toBe('c1')
  })
})

describe('computeBalances', () => {
  it('starts at the opening balance and ignores rows before opening_at', () => {
    const i = base({ expenses: [exp({ id: 'old', amount: 999, paymentMethodId: 'bank', date: '2026-09-15' })] })
    expect(bal(i, 'bank')?.balance).toBe(1000)
  })
  it('debit spend lowers the parent bank, credit spend does not', () => {
    const i = base({ expenses: [exp({ id: 'a', amount: 100, paymentMethodId: 'debit' }), exp({ id: 'b', amount: 300, paymentMethodId: 'credit' })] })
    expect(bal(i, 'bank')?.balance).toBe(900)
  })
  it('null / sentinel cash spend lowers Cash', () => {
    const i = base({ expenses: [exp({ id: 'a', amount: 50, paymentMethodId: 'pm_default_cash' })] })
    expect(bal(i, 'cash')?.balance).toBe(150)
  })
  it('cash-out moves money from the bank to Cash (two deltas, one row)', () => {
    const i = base({ expenses: [exp({ id: 'w', amount: 300, paymentMethodId: 'bank', toPaymentMethodId: 'cash', category: 'ATM Cash Withdrawal' })] })
    expect(bal(i, 'bank')?.balance).toBe(700)
    expect(bal(i, 'cash')?.balance).toBe(500)
  })
  it('an SMS-created or CC-payoff expense with no funding source never drains Cash', () => {
    const i = base({ expenses: [exp({ id: 's', amount: 50, paymentMethodId: 'pm_default_cash', smsLogId: 'log' }), exp({ id: 'c', amount: 70, paymentMethodId: 'pm_default_cash', category: 'CC Payoff' })] })
    expect(bal(i, 'cash')?.balance).toBe(200)
  })
  it('refunded expenses net to zero', () => {
    const i = base({ expenses: [exp({ id: 'r', amount: 80, paymentMethodId: 'bank', refundedAt: '2026-10-06T00:00:00Z' })] })
    expect(bal(i, 'bank')?.balance).toBe(1000)
  })
  it('a debt payment that also wrote an expense is counted once', () => {
    const i = base({
      expenses: [exp({ id: 'e', amount: 400, paymentMethodId: 'bank', linkedDebtPaymentId: 'p1', isDebtPayment: true })],
      debtPayments: [{ id: 'p1', debtId: 'd', date: '2026-10-05', amountPaid: 400, paymentMethodId: 'bank', paymentCurrency: 'EGP', createdAt: '' }],
    })
    expect(bal(i, 'bank')?.balance).toBe(600)
  })
  it('a debt payment with no expense, not funded from savings, is counted', () => {
    const i = base({ debtPayments: [{ id: 'p2', debtId: 'd', date: '2026-10-05', amountPaid: 250, paymentMethodId: 'bank', paymentCurrency: 'EGP', createdAt: '' }] })
    expect(bal(i, 'bank')?.balance).toBe(750)
  })
  it('income lands in its account only when received', () => {
    const ev = (status: 'confirmed' | 'projected') => ({ id: status, name: 's', amount: 500, currency: 'EGP', sourceType: 'salary', receivedDate: '2026-10-10', status, paymentMethodId: 'bank', createdAt: '', updatedAt: '' }) as never
    expect(bal(base({ incomeEvents: [ev('confirmed'), ev('projected')] }), 'bank')?.balance).toBe(1500)
  })
  it('held-in pockets shrink free, not balance; standalone deposits are real transfers', () => {
    const held = { id: 'p', name: 'Trip', currency: 'EGP', currentBalance: 250, heldInPaymentMethodId: 'bank' } as SavingsAccount
    const free = { id: 'q', name: 'Safe', currency: 'EGP', currentBalance: 0 } as SavingsAccount
    const tx = (accountId: string, amount: number) => ({ id: accountId, accountId, type: 'deposit', amount, currency: 'EGP', date: '2026-10-07', paymentMethodId: 'bank' }) as never
    const i = base({ savingsAccounts: [held, free], savingsTransactions: [tx('p', 250), tx('q', 100)] })
    const b = bal(i, 'bank')!
    expect(b.balance).toBe(900)
    expect(b.held).toBe(250)
    expect(b.free).toBe(650)
  })
  it('free never goes below zero', () => {
    const held = { id: 'p', currency: 'EGP', currentBalance: 5000, heldInPaymentMethodId: 'bank' } as SavingsAccount
    expect(bal(base({ savingsAccounts: [held] }), 'bank')?.free).toBe(0)
  })
  it('adjustments apply; asOf excludes later rows', () => {
    const adj = { id: 'j', paymentMethodId: 'bank', delta: -120, reason: 'gap', occurredAt: '2026-10-12T10:00:00Z', createdAt: '', updatedAt: '' } as const
    const i = base({ adjustments: [adj] })
    expect(bal(i, 'bank')?.balance).toBe(880)
    expect(bal(i, 'bank', new Date('2026-10-11T00:00:00Z').getTime())?.balance).toBe(1000)
  })
  it('flags approx when a currency has no rate and never drops the row', () => {
    const i = base({ convert: () => null, expenses: [exp({ id: 'u', amount: 10, currency: 'USD', paymentMethodId: 'bank' })] })
    expect(bal(i, 'bank')).toMatchObject({ balance: 990, approx: true })
  })
  it('is order independent and free of float drift', () => {
    const list = Array.from({ length: 50 }, (_, n) => exp({ id: `e${n}`, amount: 0.1 + n * 0.01, paymentMethodId: 'bank', date: `2026-10-${String((n % 25) + 1).padStart(2, '0')}` }))
    const a = bal(base({ expenses: list }), 'bank')!.balance
    const b = bal(base({ expenses: [...list].reverse() }), 'bank')!.balance
    expect(a).toBe(b)
    expect(Number.isInteger(Math.round(a * 100))).toBe(true)
  })
  it('untracked accounts (no opening balance) are absent', () => {
    expect(computeBalances(base({ paymentMethods: [pm({ id: 'n', type: 'bank_account' })] })).size).toBe(0)
  })
})

describe('detectGap', () => {
  const at = (iso: string) => iso
  it('needs two consistent reports and ignores a single timing race', () => {
    const ledger = () => 1000
    expect(detectGap([{ balance: 800, reportedAt: at('2026-10-10T10:00:00Z') }], ledger)).toBeNull()
    const two = [{ balance: 800, reportedAt: at('2026-10-10T10:00:00Z') }, { balance: 800, reportedAt: at('2026-10-11T10:00:00Z') }]
    expect(detectGap(two, ledger)).toMatchObject({ amount: -200, reportedAt: '2026-10-11T10:00:00Z' })
  })
  it('stays quiet when the ledger explains the reports, or the gaps disagree', () => {
    expect(detectGap([{ balance: 1000, reportedAt: 'b' }, { balance: 1000, reportedAt: 'a' }], () => 1000)).toBeNull()
    expect(detectGap([{ balance: 800, reportedAt: '2' }, { balance: 700, reportedAt: '1' }], () => 1000)).toBeNull()
  })
  it('clears itself once the ledger explains the missing money', () => {
    const rs = [{ balance: 800, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 800, reportedAt: '2026-10-10T10:00:00Z' }]
    expect(detectGap(rs, () => 800)).toBeNull()
  })
})
