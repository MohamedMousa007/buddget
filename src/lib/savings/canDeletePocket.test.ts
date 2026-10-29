import { describe, it, expect } from 'vitest'
import { canDeletePocket, isTypeLockedPocket } from './canDeletePocket'
import { isSavingsCurrencyLocked } from './savingsCurrencyLock'
import type { SavingsAccount } from '@/lib/store/types'

const acc = (id: string, type: SavingsAccount['type'] = 'bank', category: SavingsAccount['category'] = 'savings', currentBalance = 0): SavingsAccount => ({
  id, name: id, category, type, currency: 'EGP', currentBalance, createdAt: '2026-01-01',
})

describe('canDeletePocket', () => {
  const accounts = [acc('def', 'vault'), acc('goal', 'vault'), acc('bank')]
  const profile = { defaultCarryPocketId: 'def' }

  it('blocks the default monthly-savings pocket', () => {
    expect(canDeletePocket({ savingsAccounts: accounts, profile }, 'def')).toEqual({ ok: false, reason: 'default' })
  })
  it('blocks the only savings pocket', () => {
    expect(canDeletePocket({ savingsAccounts: [acc('one')], profile: { defaultCarryPocketId: null } }, 'one')).toEqual({ ok: false, reason: 'only' })
  })
  it('allows a goal-created vault pocket that is not the default', () => {
    expect(canDeletePocket({ savingsAccounts: accounts, profile }, 'goal')).toEqual({ ok: true })
  })
  it('allows a non-default vault and a plain pocket', () => {
    expect(canDeletePocket({ savingsAccounts: accounts, profile }, 'bank')).toEqual({ ok: true })
  })
  it('does not count investments as a savings pocket for the only rule, and allows deleting them', () => {
    const list = [acc('one'), acc('inv', 'other', 'investment')]
    expect(canDeletePocket({ savingsAccounts: list, profile: { defaultCarryPocketId: null } }, 'one')).toEqual({ ok: false, reason: 'only' })
    expect(canDeletePocket({ savingsAccounts: list, profile: { defaultCarryPocketId: null } }, 'inv')).toEqual({ ok: true })
  })
})

describe('isSavingsCurrencyLocked', () => {
  it('is open for an empty pocket with no history', () => {
    expect(isSavingsCurrencyLocked(acc('a'), [])).toBe(false)
  })
  it('locks once there is a balance', () => {
    expect(isSavingsCurrencyLocked(acc('a', 'bank', 'savings', 100), [])).toBe(true)
  })
  it('locks once the pocket has any transaction, even at zero', () => {
    expect(isSavingsCurrencyLocked(acc('a'), [{ accountId: 'a' }])).toBe(true)
    expect(isSavingsCurrencyLocked(acc('a'), [{ accountId: 'b' }])).toBe(false)
  })
})

describe('isTypeLockedPocket', () => {
  it('locks the default carry pocket and the system vault only', () => {
    const profile = { defaultCarryPocketId: 'def' }
    expect(isTypeLockedPocket(profile, acc('def', 'bank'))).toBe(true)
    expect(isTypeLockedPocket(profile, { ...acc('v', 'vault'), name: 'Monthly Savings' })).toBe(true)
    expect(isTypeLockedPocket(profile, acc('other', 'bank'))).toBe(false)
  })
})
