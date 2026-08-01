import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The seed guard, mirrored from useEnsureMonthlySavingsVault (hook can't run outside React). */
function seedIfNeeded() {
  const s = useFinanceStore.getState()
  if (s.savingsAccounts.length !== 0 || s.profile.defaultCarryPocketId) return false
  const id = s.addSavingsAccount({
    name: 'Monthly Savings', category: 'savings', type: 'vault',
    currency: s.settings.baseCurrency, openingBalance: 0, isEmergencyCover: false,
  } as never)
  s.updateProfile({ defaultCarryPocketId: id })
  return true
}

describe('Monthly Savings vault seeding', () => {
  beforeEach(() => {
    const p = useFinanceStore.getState().profile
    useFinanceStore.setState({ savingsAccounts: [], savingsTransactions: [], profile: { ...p, defaultCarryPocketId: undefined } })
  })

  it('creates exactly one vault and sets it as the default carry pocket', () => {
    expect(seedIfNeeded()).toBe(true)
    const s = useFinanceStore.getState()
    const vaults = s.savingsAccounts.filter((a) => a.type === 'vault')
    expect(vaults).toHaveLength(1)
    expect(vaults[0].name).toBe('Monthly Savings')
    expect(s.profile.defaultCarryPocketId).toBe(vaults[0].id)
  })

  it('never double-seeds — the default-pocket guard blocks re-runs (re-render/hydration)', () => {
    seedIfNeeded()
    expect(seedIfNeeded()).toBe(false) // default now set
    expect(seedIfNeeded()).toBe(false)
    expect(useFinanceStore.getState().savingsAccounts.filter((a) => a.type === 'vault')).toHaveLength(1)
  })

  it('does not seed when the user already has accounts', () => {
    useFinanceStore.setState({ savingsAccounts: [{ id: 'x', name: 'Bank', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 0, createdAt: '2026-01-01' }] })
    expect(seedIfNeeded()).toBe(false)
  })
})
