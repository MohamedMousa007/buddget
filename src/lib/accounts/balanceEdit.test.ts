import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { allowsNegativeBalance, balanceSave, editedBalance } from './balanceEdit'
import { setOpeningBalance, updateBalance } from './actions'

describe('balanceSave: what a tapped-and-typed balance writes', () => {
  it('a tracked account records the difference as an adjustment', () => {
    expect(balanceSave(true, 1000, 1250)).toEqual({ kind: 'adjust', delta: 250 })
    expect(balanceSave(true, 1000, -2000)).toEqual({ kind: 'adjust', delta: -3000 })
  })
  it('a tracked account with no difference writes nothing', () => {
    expect(balanceSave(true, 940, 940)).toEqual({ kind: 'none' })
    expect(balanceSave(true, 0.1 + 0.2, 0.3)).toEqual({ kind: 'none' })
  })
  it('an untracked account starts tracking from the typed amount, zero included', () => {
    expect(balanceSave(false, 0, 500)).toEqual({ kind: 'opening', amount: 500 })
    expect(balanceSave(false, 0, 0)).toEqual({ kind: 'opening', amount: 0 })
  })
  it('a three-decimal currency keeps its fils', () => {
    expect(balanceSave(true, 10, 10.005, 'KWD')).toEqual({ kind: 'adjust', delta: 0.005 })
    expect(balanceSave(true, 10, 10.0004, 'KWD')).toEqual({ kind: 'none' })
    expect(balanceSave(true, 10, 10.005, 'EGP')).toEqual({ kind: 'adjust', delta: 0.01 })
  })
  it('rounds the delta to cents', () => {
    expect(balanceSave(true, 10.005, 10.01)).toEqual({ kind: 'none' })
    expect(balanceSave(true, 10, 10.256)).toEqual({ kind: 'adjust', delta: 0.26 })
  })
})

describe('editedBalance: the pad value and the minus key', () => {
  it('only a bank account can go below zero', () => {
    expect(allowsNegativeBalance('bank_account')).toBe(true)
    for (const t of ['cash', 'wallet', 'prepaid_card', 'credit_card', 'debit_card'] as const) expect(allowsNegativeBalance(t)).toBe(false)
  })
  it('the minus applies to a bank account', () => {
    expect(editedBalance('2000', true, 'bank_account')).toBe(-2000)
    expect(editedBalance('2000', false, 'bank_account')).toBe(2000)
  })
  it('the minus is ignored anywhere else', () => {
    expect(editedBalance('2000', true, 'cash')).toBe(2000)
    expect(editedBalance('2000', true, 'wallet')).toBe(2000)
    expect(editedBalance('2000', true, 'prepaid_card')).toBe(2000)
  })
  it('an empty or unfinished pad value is no amount', () => {
    expect(editedBalance('', false, 'bank_account')).toBeNull()
    expect(editedBalance('.', false, 'bank_account')).toBeNull()
    expect(editedBalance('0.', false, 'bank_account')).toBe(0)
  })
  it('minus zero is zero', () => {
    expect(Object.is(editedBalance('0', true, 'bank_account'), 0)).toBe(true)
  })
})

describe('updateBalance follows the same decision on the real store', () => {
  beforeEach(() => useFinanceStore.getState().reset())
  it('an overdrawn bank balance lands as a negative adjustment', () => {
    const s = useFinanceStore.getState()
    const id = s.addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    setOpeningBalance(id, 1000, new Date(Date.now() - 86_400_000))
    expect(updateBalance(id, 1000, -2000)).toBe(-3000)
    expect(useFinanceStore.getState().accountAdjustments.map((a) => a.delta)).toEqual([-3000])
  })
  it('a KWD account records a fils-sized correction', () => {
    const s = useFinanceStore.getState()
    const id = s.addPaymentMethod({ name: 'NBK', type: 'bank_account', currency: 'KWD', isDefault: false })
    setOpeningBalance(id, 100, new Date(Date.now() - 86_400_000))
    expect(updateBalance(id, 100, 100.125)).toBe(0.125)
  })
})
