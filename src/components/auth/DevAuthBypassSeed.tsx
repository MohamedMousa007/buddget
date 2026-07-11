'use client'

import { useEffect } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * DEV-ONLY: mounted solely under the `NEXT_PUBLIC_DEV_AUTH_BYPASS` flag (see
 * AuthProvider). Real auth normally flips `dataReady` via SupabaseFinanceSync,
 * which never mounts without a session — so bypass mode would sit on skeletons.
 * This flips it and seeds a little demo income for local UI QA. Dead code in any
 * production build.
 */
export function DevAuthBypassSeed() {
  useEffect(() => {
    // Expose stores for local QA driving (dev-only).
    ;(window as unknown as Record<string, unknown>).__finance = useFinanceStore
    ;(window as unknown as Record<string, unknown>).__settings = useSettingsStore
    const st = useFinanceStore.getState()
    st.setDataReady(true)
    if (st.incomeSources.length === 0) {
      st.addIncomeSource({ name: 'Salary · Nexta', amount: 42000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 5, sourceType: 'salary' })
      st.addIncomeSource({ name: 'Upwork', amount: 6000, currency: 'EGP', isRecurring: true, recurringFrequency: 'biweekly', dayOfMonth: 3, sourceType: 'side_hustle' })
      st.addIncomeEvent({ name: 'Refund · Amazon', amount: 8240, currency: 'EGP', sourceType: 'refund', receivedDate: new Date().toISOString().slice(0, 10), status: 'confirmed' })
    }
  }, [])
  return null
}
