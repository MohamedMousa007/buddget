import { describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { markPulled } from '@/hooks/remote/hydrateGuard'
import { seedMonthlySavingsVault } from './useEnsureMonthlySavingsVault'

describe('S-7: the vault the app seeds is held in the primary account, as the cron one is', () => {
  it('sets heldInPaymentMethodId to the primary tracked account', () => {
    const userId = '00000000-0000-4000-8000-000000000001'
    useFinanceStore.setState((s) => ({
      profile: { ...s.profile, id: userId, defaultCarryPocketId: undefined },
      savingsAccounts: [],
      paymentMethods: [{ id: 'bank1', name: 'Bank', type: 'bank_account', currency: 'EGP', isDefault: false, openingBalance: 100, openingAt: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' }] as never,
    }))
    markPulled(userId)
    expect(seedMonthlySavingsVault()).toBe(true)
    const vault = useFinanceStore.getState().savingsAccounts[0] as { heldInPaymentMethodId?: string }
    expect(vault.heldInPaymentMethodId).toBe('bank1')
  })
})
