'use client'

import { useEffect, useRef } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * Seed the undeletable "Monthly Savings" vault once, so a new user sees it by default (item 5)
 * and the month-end carry always has a home. Mirrors the cron's create-vault insert.
 *
 * Idempotent + race-safe: only when hydrated, the user has NO savings accounts yet, AND no
 * default carry pocket is set. The last guard is the key one — the cron sets `defaultCarryPocketId`
 * whenever it creates the vault, so a returning user (whose profile hydrates with that id) never
 * double-seeds even if the savings list hasn't hydrated yet.
 */
export function useEnsureMonthlySavingsVault() {
  const dataReady = useFinanceStore((s) => s.dataReady)
  const noAccounts = useFinanceStore((s) => s.savingsAccounts.length === 0)
  const noDefault = useFinanceStore((s) => !s.profile.defaultCarryPocketId)
  const seeded = useRef(false)

  useEffect(() => {
    if (!dataReady || !noAccounts || !noDefault || seeded.current) return
    seeded.current = true
    const s = useFinanceStore.getState()
    const id = s.addSavingsAccount({
      name: 'Monthly Savings',
      category: 'savings',
      type: 'vault',
      currency: s.settings.baseCurrency,
      openingBalance: 0,
      isEmergencyCover: false,
    } as never)
    s.updateProfile({ defaultCarryPocketId: id })
  }, [dataReady, noAccounts, noDefault])
}
