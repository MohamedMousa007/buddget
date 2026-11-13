'use client'

import { useMemo } from 'react'
import { usePaymentMethodDetector, type DetectedAccount } from '@/hooks/usePaymentMethodDetector'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { unsettledAccounts } from '@/lib/alerts/detectedAccounts'

/** Accounts, cards and wallets the bank messages mention that no payment method owns yet, and nobody said "Not mine" to. */
export function useDetectedAccounts(hidden?: ReadonlySet<string>): DetectedAccount[] {
  const detected = usePaymentMethodDetector()
  const settled = useFinanceStore((s) => s.settings.promptState)
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
  return useMemo(() => unsettledAccounts(detected, settled, dismissed, hidden), [detected, settled, dismissed, hidden])
}
