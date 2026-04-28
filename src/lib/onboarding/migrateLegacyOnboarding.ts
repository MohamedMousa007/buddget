'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { valueForPaymentStep } from '@/lib/onboarding/onboardingPageHelpers'
import {
  defaultColorForPaymentMethodType,
  defaultIconEmojiForPaymentMethodType,
} from '@/lib/payment/paymentMethodDefaults'

/**
 * One-shot idempotent migrator for legacy-onboarding state.
 *
 * Two responsibilities, both bounded by `settings.legacyOnboardingMigratedAt`
 * (client-only per-device flag so each device runs this once):
 *
 *   1. Drain stranded `payment_methods` drafts. The legacy expert flow stashed
 *      draft rows under `onboardingState.answers.payment_methods` and only
 *      applied them when the user hit Finish. If they abandoned mid-flow or
 *      we flipped them to progressive onboarding, those drafts need draining.
 *      We apply them *and* clear the answer key so cross-device sync doesn't
 *      re-apply them on a second device (which would otherwise create
 *      duplicates since `legacyOnboardingMigratedAt` is client-only).
 *
 *   2. Auto-hide the first-run checklist for users who already finished the
 *      legacy 27-step flow. Their `user_metadata.onboarding_source` is either
 *      missing or set to something other than `'core_gate'`, meaning they
 *      never saw the progressive gate. They have income, maybe a budget, and
 *      shouldn't suddenly see a "Finish setup" checklist with their KPI grid
 *      hidden — that's a regression, not an improvement. Fresh core-gate
 *      users keep the checklist visible.
 */
export function useLegacyOnboardingMigrator() {
  const ran = useRef(false)
  const { user } = useAuth()
  const migratedAt = useFinanceStore((s) => s.settings.legacyOnboardingMigratedAt)

  useEffect(() => {
    if (ran.current) return
    if (migratedAt) return
    // Wait for auth to resolve so we can read onboarding_source.
    if (!user) return
    ran.current = true

    const state = useFinanceStore.getState()
    const wentThroughCoreGate =
      user.user_metadata?.onboarding_source === 'core_gate'

    // 1) Drain + clear stranded payment drafts.
    try {
      const parsed = valueForPaymentStep(state.onboardingState.answers)
      if (parsed.length > 0) {
        for (const d of parsed) {
          const pmName = d.nickname || d.preset
          state.addPaymentMethod({
            name: pmName,
            type: d.type,
            currency: state.settings.baseCurrency,
            color: defaultColorForPaymentMethodType(d.type, pmName),
            icon: defaultIconEmojiForPaymentMethodType(d.type),
            isDefault: false,
          })
        }
        // Clear the draft bucket so a second device syncing this row doesn't
        // re-apply the same drafts and create duplicates.
        state.setOnboardingState((prev) => {
          const nextAnswers = { ...prev.answers }
          delete nextAnswers.payment_methods
          return { ...prev, answers: nextAnswers }
        })
      }
    } catch (e) {
      console.error('[migrateLegacyOnboarding] payment draft apply failed', e)
    }

    // 2) Auto-hide checklist for legacy users so we don't suppress their KPIs.
    if (!wentThroughCoreGate) {
      state.updateSettings({ onboardingChecklistHidden: true })
    }

    state.updateSettings({ legacyOnboardingMigratedAt: new Date().toISOString() })
  }, [migratedAt, user])
}
