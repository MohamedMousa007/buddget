'use client'

import { useEffect, useRef } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { valueForPaymentStep } from '@/lib/onboarding/onboardingPageHelpers'

/**
 * One-shot idempotent migrator for legacy-onboarding drafts.
 *
 * The only survey step whose answers don't live-mutate a store slice is
 * `payment_methods`: the expert flow stashed drafts under `onboardingState.
 * answers.payment_methods` and applied them when the user hit Finish. If a
 * user started the legacy flow, picked payment methods, but never made it to
 * Finish (they bounced, or we flipped them to progressive mid-session), those
 * drafts are stranded.
 *
 * On first mount post-rollout we drain those drafts into `paymentMethods` and
 * mark the run so it never repeats. Everything else (income, debts,
 * subscriptions) was already live-persisted by its respective step component.
 *
 * Fully client-only: `legacyOnboardingMigratedAt` is excluded from Supabase
 * sync, so each device runs the migrator at most once.
 */
export function useLegacyOnboardingMigrator() {
  const ran = useRef(false)
  const migratedAt = useFinanceStore((s) => s.settings.legacyOnboardingMigratedAt)

  useEffect(() => {
    if (ran.current) return
    if (migratedAt) return
    ran.current = true

    const state = useFinanceStore.getState()
    try {
      const parsed = valueForPaymentStep(state.onboardingState.answers)
      if (parsed.length > 0) {
        for (const d of parsed) {
          state.addPaymentMethod({
            name: d.nickname || d.preset,
            type: d.type,
            currency: state.settings.baseCurrency,
            isDefault: false,
          })
        }
      }
    } catch (e) {
      console.error('[migrateLegacyOnboarding] payment draft apply failed', e)
    }

    state.updateSettings({ legacyOnboardingMigratedAt: new Date().toISOString() })
  }, [migratedAt])
}
