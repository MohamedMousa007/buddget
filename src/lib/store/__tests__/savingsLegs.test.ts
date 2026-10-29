import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances } from '@/lib/accounts/balance'
import { primaryTrackedAccount, deterministicId, incomeEventIdForTx } from '@/lib/savings/accountLeg'
import { pickPrimaryAccountId } from '@/lib/accounts/primary'
import { dueDatesThrough, recurringTxId } from '@/lib/savings/recurringDue'
import { resolveCarryDestination } from '@/lib/savings/monthCarry'
import { actualIncomeForMonth } from '@/lib/utils/calculations'
import { zakatAccountsFromLedger } from '@/lib/savings/zakatAccounts'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

const S = () => useFinanceStore.getState()
const pm = (id: string, type: PaymentMethod['type'], createdAt: string, over: Partial<PaymentMethod> = {}): PaymentMethod =>
  ({ id, name: id, type, currency: 'EGP', createdAt, openingBalance: 1000, openingAt: '2026-01-01T00:00:00.000Z', ...over }) as PaymentMethod
const pocket = (id: string, over: Partial<SavingsAccount> = {}): SavingsAccount =>
  ({ id, name: id, category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: '2026-01-01', ...over }) as SavingsAccount
const bal = (id = 'bank') => {
  const s = S()
  return computeBalances({
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: [], convert: (a) => a,
  }).get(id)!.balance
}
const seed = (pockets: SavingsAccount[], methods: PaymentMethod[] = [pm('bank', 'bank_account', '2026-01-01')]) =>
  useFinanceStore.setState({
    paymentMethods: methods, savingsAccounts: pockets, savingsTransactions: [], incomeEvents: [], goals: [], expenses: [], debtPayments: [],
    exchangeRates: { USD_EGP: 50, EGP_USD: 0.02 },
  })

describe('W2 account legs', () => {
  beforeEach(() => seed([pocket('p1', { currentBalance: 500 })]))

  it('allocate deposit debits the primary account', () => {
    S().depositToSavings('p1', 300, 'EGP')
    expect(S().savingsTransactions[0].paymentMethodId).toBe('bank')
    expect(bal()).toBe(700)
  })
  it('declare, explicit null, and no tracked account stamp nothing', () => {
    S().depositToSavings('p1', 100, 'EGP', undefined, { mode: 'declare' })
    S().depositToSavings('p1', 100, 'EGP', undefined, { fromAccountId: null })
    expect(S().savingsTransactions.every((t) => !t.paymentMethodId)).toBe(true)
    seed([pocket('p1')], [])
    S().depositToSavings('p1', 100, 'EGP')
    expect(S().savingsTransactions[0].paymentMethodId).toBeUndefined()
  })
  it('withdraw as income credits the account exactly once (event side only)', () => {
    S().withdrawFromSavings('p1', 300, 'EGP')
    expect(S().savingsTransactions[0].paymentMethodId).toBeUndefined()
    expect(S().incomeEvents[0].paymentMethodId).toBe('bank')
    expect(bal()).toBe(1300)
  })
  it('withdraw to debt/spend and transfers and corrections leave the account alone', () => {
    seed([pocket('p1', { currentBalance: 500 }), pocket('p2')])
    S().withdrawFromSavings('p1', 100, 'EGP', undefined, 'debt')
    S().transferBetweenPockets('p1', 'p2', 100)
    S().correctSavingsBalance('p2', 400)
    expect(bal()).toBe(1000)
  })
  it('cross-currency account gets no leg (not FX-frozen)', () => {
    seed([pocket('u', { currency: 'USD' })])
    S().depositToSavings('u', 10, 'USD')
    expect(S().savingsTransactions[0].paymentMethodId).toBeUndefined()
  })
  it('pocket held in the source account gets no leg', () => {
    seed([pocket('p1', { heldInPaymentMethodId: 'bank' })])
    S().depositToSavings('p1', 100, 'EGP')
    expect(S().savingsTransactions[0].paymentMethodId).toBeUndefined()
  })
  it('explicit fromAccountId wins; deleting the deposit restores the account', () => {
    seed([pocket('p1')], [pm('bank', 'bank_account', '2026-01-01'), pm('w', 'wallet', '2026-02-01')])
    S().depositToSavings('p1', 200, 'EGP', undefined, { fromAccountId: 'w' })
    expect(bal('w')).toBe(800)
    expect(S().deleteSavingsTransaction(S().savingsTransactions[0].id)).toEqual({ ok: true })
    expect(bal('w')).toBe(1000)
  })
  it('one definition of primary: oldest bank, else oldest wallet, closed/untracked skipped', () => {
    const ms = [pm('w', 'wallet', '2026-01-01'), pm('b2', 'bank_account', '2026-03-01'), pm('b1', 'bank_account', '2026-02-01'), pm('c', 'bank_account', '2025-01-01', { closedAt: '2026-01-01' })]
    expect(primaryTrackedAccount(ms)).toBe('b1')
    expect(primaryTrackedAccount([ms[0]])).toBe('w')
    expect(pickPrimaryAccountId([{ id: 'b2', type: 'bank_account', createdAt: '2026-03-01' }, { id: 'b1', type: 'bank_account', createdAt: '2026-02-01' }])).toBe('b1')
  })
})

describe('W5 / W6 delete', () => {
  beforeEach(() => seed([pocket('p1', { currentBalance: 500 })]))

  it('deleting an income withdrawal removes its own event only', () => {
    S().withdrawFromSavings('p1', 200, 'EGP')
    S().withdrawFromSavings('p1', 200, 'EGP')
    const [t1, t2] = S().savingsTransactions
    expect(incomeEventIdForTx(t1.id)).not.toBe(incomeEventIdForTx(t2.id))
    expect(S().deleteSavingsTransaction(t1.id)).toEqual({ ok: true })
    expect(S().incomeEvents.map((e) => e.id)).toEqual([incomeEventIdForTx(t2.id)])
    expect(S().savingsAccounts[0].currentBalance).toBe(300)
  })
  it('refuses a delete that would take the pocket negative', () => {
    seed([pocket('p1')])
    S().depositToSavings('p1', 500, 'EGP')
    const dep = S().savingsTransactions[0].id
    S().withdrawFromSavings('p1', 400, 'EGP', undefined, 'spend')
    const r = S().deleteSavingsTransaction(dep)
    expect(r).toMatchObject({ ok: false, reason: 'would_go_negative', accountId: 'p1' })
    expect(S().savingsAccounts[0].currentBalance).toBe(100)
    expect(S().savingsTransactions).toHaveLength(2)
  })
  it('unknown id is not_found', () => {
    expect(S().deleteSavingsTransaction('nope')).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('W12 recurring idempotency', () => {
  beforeEach(() => seed([pocket('p1')]))
  it('same txId posts once; catch-up yields one id per due date', () => {
    const id = recurringTxId('r1', '2026-10-01')
    S().depositToSavings('p1', 100, 'EGP', undefined, { txId: id })
    S().depositToSavings('p1', 100, 'EGP', undefined, { txId: id })
    expect(S().savingsTransactions).toHaveLength(1)
    expect(S().savingsAccounts[0].currentBalance).toBe(100)
    const { due, next } = dueDatesThrough('2026-08-15', '2026-10-27')
    expect(due).toBe('2026-10-15')
    expect(next).toBe('2026-11-15')
    expect(dueDatesThrough('2026-10-15', '2026-10-15')).toEqual({ due: '2026-10-15', next: '2026-11-15' })
    expect(dueDatesThrough('2025-01-15', '2026-10-27').due).toBe('2026-10-15')
    expect(dueDatesThrough('2026-01-31', '2026-03-01').next).toBe('2026-03-31')
    expect(dueDatesThrough('2026-02-28', '2026-02-28', 31).next).toBe('2026-03-31')
    expect(dueDatesThrough('2026-03-31', '2026-03-31', 31).next).toBe('2026-04-30')
    expect(deterministicId('a')).toBe(deterministicId('a'))
    expect(deterministicId('a')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('W13 / W14', () => {
  it('realizedOnly ignores projected recurring income', () => {
    const tpl = { id: 't', name: 'Salary', amount: 1000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 25, createdAt: '2026-01-01T00:00:00Z', effectiveStart: '2026-01-01' } as never
    const rates = {}
    expect(actualIncomeForMonth([tpl], [], 'EGP', rates, '2026-09')).toBeGreaterThan(0)
    expect(actualIncomeForMonth([tpl], [], 'EGP', rates, '2026-09', 1, true)).toBe(0)
  })
  it('vault fallback skips goal-owned vault pockets', () => {
    const goalPocket = pocket('gp', { type: 'vault' as never })
    const shared = pocket('shared', { type: 'vault' as never })
    const done = { id: 'g', status: 'achieved', linkedSavingsAccountIds: ['gp'] } as never
    expect(resolveCarryDestination(null, [goalPocket, shared], [done])).toEqual({ kind: 'pocket', pocketId: 'shared' })
    expect(resolveCarryDestination(null, [goalPocket], [done])).toEqual({ kind: 'create-vault' })
  })
})

describe('F15 / F17', () => {
  it('a one-time template with a realized event is counted once', () => {
    const tpl = { id: 't', name: 'Bonus', amount: 1000, currency: 'EGP', isRecurring: false, createdAt: '2026-09-10T00:00:00Z' } as never
    const ev = { id: 'e', templateId: 't', amount: 1000, currency: 'EGP', status: 'confirmed', receivedDate: '2026-09-12', occurrenceDate: '2026-09-12', updatedAt: '2026-09-12T00:00:00Z', createdAt: '2026-09-12T00:00:00Z' } as never
    expect(actualIncomeForMonth([tpl], [ev], 'EGP', {}, '2026-09')).toBe(1000)
  })
  it('a pocket held in an excluded account is still counted once, via the pocket', () => {
    const excl = pm('bank', 'bank_account', '2026-01-01', { excluded: true })
    const held = pocket('p1', { heldInPaymentMethodId: 'bank', currentBalance: 500 })
    const { trackedAccounts, heldInPocketIds } = zakatAccountsFromLedger({
      paymentMethods: [excl], expenses: [], incomeEvents: [], debts: [], debtPayments: [], savingsTransactions: [],
      savingsAccounts: [held], adjustments: [], convert: (a) => a,
    })
    expect(trackedAccounts).toHaveLength(0)
    expect(heldInPocketIds.has('p1')).toBe(false)
  })
})
