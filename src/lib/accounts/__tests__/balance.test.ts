import { describe, expect, it } from 'vitest'
import type { Expense, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '../balance'
import { detectGap } from '../gap'
import { resolveAccountId } from '../resolve'
import { incomeEventIdForTx } from '@/lib/savings/accountLeg'

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
  paymentMethods: [bank, cash, debit, credit], expenses: [], incomeEvents: [], debts: [], debtPayments: [],
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
  it('fires when the ledger matched the previous report and misses the newest one once it has settled', () => {
    const ledger = () => 1000
    const rs = [{ balance: 750, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 1000, reportedAt: '2026-10-10T10:00:00Z' }]
    const later = Date.parse('2026-10-11T10:30:00Z')
    expect(detectGap(rs, ledger, 1, later)).toMatchObject({ amount: -250, reportedAt: '2026-10-11T10:00:00Z' })
  })
  it('waits for the newest report to settle before trusting a drift the previous report did not have', () => {
    const rs = [{ balance: 750, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 1000, reportedAt: '2026-10-10T10:00:00Z' }]
    expect(detectGap(rs, () => 1000, 1, Date.parse('2026-10-11T10:05:00Z'))).toBeNull()
  })
  it('fires when the unexplained amount grows between two reports, once the newest has settled', () => {
    const rs = [{ balance: 750, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 900, reportedAt: '2026-10-10T10:00:00Z' }]
    const later = Date.parse('2026-10-11T11:00:00Z')
    expect(detectGap(rs, () => 1000, 1, later)).toMatchObject({ amount: -250 })
    expect(detectGap(rs, () => 1000, 1, Date.parse('2026-10-11T10:05:00Z'))).toBeNull()
  })
  it('stays quiet when the unexplained amount shrinks or flips sign', () => {
    const shrinking = [{ balance: 900, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 700, reportedAt: '2026-10-10T10:00:00Z' }]
    expect(detectGap(shrinking, () => 1000, 1, Date.parse('2026-10-12T10:00:00Z'))).toBeNull()
    const flipped = [{ balance: 1100, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 900, reportedAt: '2026-10-10T10:00:00Z' }]
    expect(detectGap(flipped, () => 1000, 1, Date.parse('2026-10-12T10:00:00Z'))).toBeNull()
  })
  it('clears itself once the ledger explains the missing money', () => {
    const rs = [{ balance: 800, reportedAt: '2026-10-11T10:00:00Z' }, { balance: 800, reportedAt: '2026-10-10T10:00:00Z' }]
    expect(detectGap(rs, () => 800)).toBeNull()
  })
})

describe('legacy gold debt payment (F7)', () => {
  const goldDebt = { id: 'g', isGold: true, currency: 'EGP', direction: 'borrowed' } as never
  const legacy = { id: 'p', debtId: 'g', date: '2026-10-05', amountPaid: 5, paymentCurrency: 'EGP', paymentMethodId: 'bank', createdAt: '' }
  it('grams with no recorded money amount do not debit the account 1:1', () => {
    expect(bal(base({ debts: [goldDebt], debtPayments: [legacy] }), 'bank')?.balance).toBe(1000)
  })
  it('a gold payment with a recorded money amount still debits it', () => {
    expect(bal(base({ debts: [goldDebt], debtPayments: [{ ...legacy, originalAmount: 300 }] }), 'bank')?.balance).toBe(700)
  })
})

describe('pocket exits move the holding account (S-2)', () => {
  const held = { id: 'trip', name: 'Trip', currency: 'EGP', currentBalance: 300, heldInPaymentMethodId: 'bank' } as SavingsAccount
  const held2 = { id: 'trip2', name: 'Trip2', currency: 'EGP', currentBalance: 0, heldInPaymentMethodId: 'bank' } as SavingsAccount
  const heldCash = { id: 'tc', name: 'TC', currency: 'EGP', currentBalance: 0, heldInPaymentMethodId: 'cash' } as SavingsAccount
  const standalone = { id: 'q', name: 'Q', currency: 'EGP', currentBalance: 0 } as SavingsAccount
  const stx = (o: Record<string, unknown>) =>
    ({ id: 't1', accountId: 'trip', type: 'withdrawal', amount: 100, currency: 'EGP', date: '2026-10-07', ...o }) as never
  const run = (txs: unknown[], pockets: SavingsAccount[] = [held, standalone], extra: Partial<LedgerInput> = {}) =>
    base({ savingsAccounts: pockets, savingsTransactions: txs as never, ...extra })

  it('spend from a held pocket lowers the holder and leaves free unchanged', () => {
    const b0 = bal(run([]), 'bank')!
    const b = bal(run([stx({})], [{ ...held, currentBalance: 200 }, standalone]), 'bank')!
    expect(b.balance).toBe(900)
    expect(b0.free).toBe(700)
    expect(b.free).toBe(700)
    expect(b.held).toBe(200)
  })
  it('debt-funded and invest withdrawals lower the holder', () => {
    const debt = stx({ id: 'd1', source: 'debt' })
    const inv = stx({ id: 'i1', amount: 50, source: 'transfer' })
    expect(bal(run([debt, inv]), 'bank')?.balance).toBe(850)
  })
  it('income with a paired event and no account leaves the holder alone', () => {
    const ev = { id: incomeEventIdForTx('t1'), name: 'x', amount: 100, currency: 'EGP', sourceType: 'other', receivedDate: '2026-10-07', status: 'confirmed', createdAt: '', updatedAt: '' }
    expect(bal(run([stx({})], undefined, { incomeEvents: [ev as never] }), 'bank')?.balance).toBe(1000)
  })
  it('income sent to another account debits the holder once and credits the target once', () => {
    const ev = { id: incomeEventIdForTx('t1'), name: 'x', amount: 100, currency: 'EGP', sourceType: 'other', receivedDate: '2026-10-07', status: 'confirmed', paymentMethodId: 'cash', createdAt: '', updatedAt: '' }
    const i = run([stx({})], undefined, { incomeEvents: [ev as never] })
    expect(bal(i, 'bank')?.balance).toBe(900)
    expect(bal(i, 'cash')?.balance).toBe(300)
  })
  it('opening deposit and corrections never move the holder', () => {
    const open = stx({ id: 'o', type: 'deposit', isCashFlow: false })
    const fix = stx({ id: 'c', isCashFlow: false })
    expect(bal(run([open, fix]), 'bank')?.balance).toBe(1000)
  })
  it('a deposit with no account is an earmark, not a leg', () => {
    expect(bal(run([stx({ type: 'deposit' })]), 'bank')?.balance).toBe(1000)
  })
  it('a carry withdrawal with no account moves nothing; with the primary account it keeps the transfer legs', () => {
    expect(bal(run([stx({ source: 'carry' })]), 'bank')?.balance).toBe(1000)
    const withAcc = run([stx({ source: 'carry', paymentMethodId: 'cash' })])
    expect(bal(withAcc, 'cash')?.balance).toBe(300)
    expect(bal(withAcc, 'bank')?.balance).toBe(900)
  })
  it('move held -> standalone lowers the holder; standalone -> held raises it', () => {
    const out = [stx({ id: 'a', transferGroupId: 'g', isCashFlow: false }), stx({ id: 'b', accountId: 'q', type: 'deposit', transferGroupId: 'g', isCashFlow: false })]
    expect(bal(run(out), 'bank')?.balance).toBe(900)
    const inn = [stx({ id: 'a', accountId: 'q', transferGroupId: 'g', isCashFlow: false }), stx({ id: 'b', accountId: 'trip', type: 'deposit', transferGroupId: 'g', isCashFlow: false })]
    expect(bal(run(inn), 'bank')?.balance).toBe(1100)
  })
  it('move between two pockets of the same holder changes nothing', () => {
    const legs = [stx({ id: 'a', transferGroupId: 'g', isCashFlow: false }), stx({ id: 'b', accountId: 'trip2', type: 'deposit', transferGroupId: 'g', isCashFlow: false })]
    expect(bal(run(legs, [held, held2]), 'bank')?.balance).toBe(1000)
  })
  it('move between pockets of two holders debits one and credits the other', () => {
    const legs = [stx({ id: 'a', transferGroupId: 'g', isCashFlow: false }), stx({ id: 'b', accountId: 'tc', type: 'deposit', transferGroupId: 'g', isCashFlow: false })]
    const i = run(legs, [held, heldCash])
    expect(bal(i, 'bank')?.balance).toBe(900)
    expect(bal(i, 'cash')?.balance).toBe(300)
  })
  it('an orphan transfer leg counts as crossing', () => {
    expect(bal(run([stx({ transferGroupId: 'g', isCashFlow: false })]), 'bank')?.balance).toBe(900)
  })
  it('a held pocket in an untracked holder throws nothing and adds no entry', () => {
    const p = { ...held, heldInPaymentMethodId: 'debit' } as SavingsAccount
    const out = computeBalances(run([stx({})], [p]))
    expect(out.has('debit')).toBe(false)
    expect(out.get('bank')?.balance).toBe(1000)
  })
  it('a withdrawal at or before the holder opening anchor makes no leg', () => {
    expect(bal(run([stx({ occurredAt: '2026-09-30T10:00:00.000Z', date: '2026-09-30' })]), 'bank')?.balance).toBe(1000)
  })
  it('a withdrawal from a standalone pocket never touches an account', () => {
    expect(bal(run([stx({ accountId: 'q' })]), 'bank')?.balance).toBe(1000)
  })
})
