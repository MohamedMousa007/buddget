import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { ensureCashAccount, seedSystemCash, setOpeningBalance, systemCashId } from '../actions'
import { isSetUpAccount } from '../kinds'

const s = () => useFinanceStore.getState()
const USER = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0'
const realCash = () => s().paymentMethods.filter((m) => m.type === 'cash' && m.id !== 'pm_default_cash' && !m.closedAt)

describe('system Cash (SYSTEM_CASH_PLAN phase 1)', () => {
  beforeEach(() => {
    s().reset()
    s().updateProfile({ id: USER } as never)
  })

  it('a new user gets one untracked Cash with the fixed id and an old edit time', () => {
    expect(seedSystemCash()).toBe(true)
    const cash = realCash()
    expect(cash).toHaveLength(1)
    expect(cash[0].id).toBe(systemCashId(USER))
    expect(cash[0].openingBalance).toBeUndefined()
    expect(Date.parse(cash[0].updatedAt!)).toBeLessThan(Date.parse('2001-01-01'))
  })

  it('running again adds nothing', () => {
    seedSystemCash()
    expect(seedSystemCash()).toBe(false)
    expect(ensureCashAccount()).toBe(systemCashId(USER))
    expect(realCash()).toHaveLength(1)
  })

  it('an existing real Cash is adopted, never duplicated', () => {
    const mine = s().addPaymentMethod({ name: 'Cash', type: 'cash', currency: 'EGP', isDefault: false })
    expect(seedSystemCash()).toBe(false)
    expect(ensureCashAccount()).toBe(mine)
    expect(realCash()).toHaveLength(1)
  })

  it('a tracked balance survives a later seed or ensure', () => {
    const id = ensureCashAccount()
    setOpeningBalance(id, 750)
    seedSystemCash()
    ensureCashAccount()
    expect(realCash()).toHaveLength(1)
    expect(realCash()[0].openingBalance).toBe(750)
  })

  it('the fixed id is a uuid and differs per user', () => {
    expect(systemCashId(USER)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(systemCashId(USER)).not.toBe(systemCashId('11111111-2222-3333-4444-555555555555'))
    expect(systemCashId(USER)).not.toBe(USER)
  })

  it('an untracked Cash is not a set-up account; a tracked one and any bank are', () => {
    seedSystemCash()
    const cash = realCash()[0]
    expect(isSetUpAccount(cash)).toBe(false)
    setOpeningBalance(cash.id, 100)
    expect(isSetUpAccount(s().paymentMethods.find((m) => m.id === cash.id)!)).toBe(true)
    const bank = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: 'EGP', isDefault: false })
    expect(isSetUpAccount(s().paymentMethods.find((m) => m.id === bank)!)).toBe(true)
  })
})
