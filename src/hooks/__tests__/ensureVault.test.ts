import { describe, it, expect, beforeEach } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { markPulled, resetHydrationGuard } from '@/hooks/remote/hydrateGuard'
import { seedMonthlySavingsVault } from '@/hooks/useEnsureMonthlySavingsVault'
import { systemVaultId } from '@/lib/savings/pocketIdentity'

const USER = '3f2b8c1e-9d4a-4e7b-8a21-5c6d7e8f9a0b'

describe('Monthly Savings vault seeding', () => {
  beforeEach(() => {
    resetHydrationGuard()
    const p = useFinanceStore.getState().profile
    useFinanceStore.setState({ savingsAccounts: [], savingsTransactions: [], profile: { ...p, id: USER, defaultCarryPocketId: undefined } })
  })

  it('creates exactly one vault with the id derived from the user and sets it as the default carry pocket', () => {
    markPulled(USER)
    expect(seedMonthlySavingsVault()).toBe(true)
    const s = useFinanceStore.getState()
    const vaults = s.savingsAccounts.filter((a) => a.type === 'vault')
    expect(vaults).toHaveLength(1)
    expect(vaults[0].id).toBe(systemVaultId(USER))
    expect(s.profile.defaultCarryPocketId).toBe(vaults[0].id)
  })

  it('two clients of one user derive the same vault id (QA-108)', () => {
    expect(systemVaultId(USER)).toBe(systemVaultId(USER))
    expect(systemVaultId(USER)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(systemVaultId(USER)).not.toBe(USER)
  })

  it('does not seed before the server data has been pulled this session', () => {
    expect(seedMonthlySavingsVault()).toBe(false)
    expect(useFinanceStore.getState().savingsAccounts).toHaveLength(0)
  })

  it('does not seed when a default carry pocket is already set or accounts exist', () => {
    markPulled(USER)
    useFinanceStore.getState().updateProfile({ defaultCarryPocketId: 'existing' })
    expect(seedMonthlySavingsVault()).toBe(false)
  })

  it('QA-108: a user whose vault predates the derived id keeps it: no second vault is seeded', () => {
    markPulled(USER)
    const legacyId = useFinanceStore.getState().addSavingsAccount({
      name: 'Monthly Savings', category: 'savings', type: 'vault', currency: 'EGP', openingBalance: 0, isEmergencyCover: false,
    } as never)
    expect(legacyId).not.toBe(systemVaultId(USER))
    expect(seedMonthlySavingsVault()).toBe(false)
    expect(useFinanceStore.getState().savingsAccounts.map((a) => a.id)).toEqual([legacyId])
  })
})
