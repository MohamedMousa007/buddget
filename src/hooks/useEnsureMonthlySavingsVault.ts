'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { hasPulled, subscribePulled } from '@/hooks/remote/hydrateGuard'
import { SYSTEM_VAULT_NAME, systemVaultId } from '@/lib/savings/pocketIdentity'
import { primaryTrackedAccount } from '@/lib/savings/accountLeg'

/**
 * Seeds the "Monthly Savings" vault when the user has no savings accounts and no default carry pocket.
 * The id is derived from the user id, so every client and the month-end cron write the same row. Only valid
 * after the server's data has been merged: a stale cache or a failed pull must not look like a new account.
 * Returns whether it seeded.
 */
export function seedMonthlySavingsVault(): boolean {
  const s = useFinanceStore.getState()
  const userId = s.profile.id
  if (!userId || !hasPulled(userId) || s.savingsAccounts.length !== 0 || s.profile.defaultCarryPocketId) return false
  const id = s.addSavingsAccount({
    id: systemVaultId(userId),
    name: SYSTEM_VAULT_NAME,
    category: 'savings',
    type: 'vault',
    currency: s.settings.baseCurrency,
    openingBalance: 0,
    isEmergencyCover: false,
    // S-7: held in the primary account, like the vault the month-carry cron creates (QA-108).
    heldInPaymentMethodId: primaryTrackedAccount(s.paymentMethods) ?? undefined,
  } as never)
  s.updateProfile({ defaultCarryPocketId: id })
  return true
}

export function useEnsureMonthlySavingsVault() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  const noAccounts = useFinanceStore((s) => s.savingsAccounts.length === 0)
  const noDefault = useFinanceStore((s) => !s.profile.defaultCarryPocketId)
  const userId = useFinanceStore((s) => s.profile.id)
  const pulled = useSyncExternalStore(subscribePulled, () => (userId ? hasPulled(userId) : false), () => false)
  const seeded = useRef(false)

  useEffect(() => {
    if (!dataReady || !pulled || !noAccounts || !noDefault || seeded.current) return
    seeded.current = seedMonthlySavingsVault()
  }, [dataReady, pulled, noAccounts, noDefault])
}
