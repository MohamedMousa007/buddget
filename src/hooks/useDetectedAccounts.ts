'use client'

import { useMemo } from 'react'
import { usePaymentMethodDetector, type DetectedAccount } from '@/hooks/usePaymentMethodDetector'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { unsettledAccounts } from '@/lib/alerts/detectedAccounts'
import { provisionalAsDetected } from '@/lib/accounts/provisional'

/**
 * Accounts waiting for the user's answer: provisional ones the server created from a bank message (first), then the
 * accounts, cards and wallets the messages mention that no payment method owns yet and nobody said "Not mine" to.
 */
export function useDetectedAccounts(hidden?: ReadonlySet<string>): DetectedAccount[] {
  const detected = usePaymentMethodDetector()
  const settled = useFinanceStore((s) => s.settings.promptState)
  const dismissed = useSettingsStore((s) => s.dismissedBanners)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const expenses = useFinanceStore((s) => s.expenses)
  const incomeEvents = useFinanceStore((s) => s.incomeEvents)
  return useMemo(
    () => [
      ...provisionalAsDetected(methods, { expenses, incomeEvents }).filter((a) => !hidden?.has(a.key)),
      ...unsettledAccounts(detected, settled, dismissed, hidden),
    ],
    [detected, settled, dismissed, hidden, methods, expenses, incomeEvents],
  )
}
