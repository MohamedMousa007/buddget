'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OnboardingStepForm, type StepContinuePayload } from '@/components/onboarding/OnboardingStepForm'
import { useAuth } from '@/components/auth/auth-context'
import { useT, useLocale } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { getGuestNickname } from '@/lib/guest/guestSession'
import { getGuestSurveyConfig } from '@/lib/onboarding/guestSurveyConfig'
import {
  applyLocaleFromProfile,
  applyMapsTo,
} from '@/lib/onboarding/onboardingPageHelpers'
import { ONBOARDING_FLOW_VERSION } from '@/lib/onboarding/onboardingTypes'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'

/**
 * Minimal 6-step onboarding surfaced immediately after a user picks
 * "Continue as guest" on the landing page. Reuses the existing
 * `OnboardingStepForm` primitive so the inputs look the same as the expert
 * flow, but skips the progress-journey / Buddgy-plan chrome since guests
 * don't need those.
 *
 * On finish: marks `onboardingState.planAccepted = true` + `flowVersion` to
 * unblock the app gate, then routes to `/`.
 */
export function GuestOnboardingView() {
  const t = useT()
  const { locale } = useLocale()
  const router = useRouter()
  const { mode, endGuest } = useAuth()
  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const setOnboardingState = useFinanceStore((s) => s.setOnboardingState)
  const onboardingState = useFinanceStore((s) => s.onboardingState)

  const config = useMemo(
    () => getGuestSurveyConfig(t, profile.name || getGuestNickname() || 'Friend'),
    [t, profile.name],
  )
  const steps = config.steps
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  const step = steps[index] as SurveyStep | undefined
  const isLast = index === steps.length - 1

  const initialTextForStep = useCallback(
    (s: SurveyStep): string => {
      if (s.type === 'text') {
        const stored = answers[s.id]
        if (typeof stored === 'string' && stored) return stored
        if (s.id === 'display_name' && profile.name) return profile.name
        if (s.id === 'city' && profile.city) return profile.city
        return s.defaultValue ?? ''
      }
      if (s.type === 'country_select') {
        const stored = answers[s.id]
        if (typeof stored === 'string' && stored) return stored
        if (profile.country) return profile.country
        return ''
      }
      return ''
    },
    [answers, profile.name, profile.city, profile.country],
  )

  const initialSelectedForStep = useCallback(
    (s: SurveyStep): string | null => {
      if (s.type !== 'single_select') return null
      const stored = answers[s.id]
      if (typeof stored === 'string') return stored
      if (s.id === 'base_currency') return settings.baseCurrency
      if (s.id === 'secondary_currency') return settings.secondaryCurrency ?? 'none'
      if (s.id === 'gender') return profile.gender ?? null
      return null
    },
    [answers, settings.baseCurrency, settings.secondaryCurrency, profile.gender],
  )

  const finish = useCallback(() => {
    // Flag guest onboarding as complete by reusing the existing "plan accepted"
    // contract — the gate only cares that this returns true, not how we got there.
    setOnboardingState({
      ...onboardingState,
      flowVersion: ONBOARDING_FLOW_VERSION,
      planAccepted: true,
    })
    router.replace('/')
  }, [onboardingState, router, setOnboardingState])

  const handleContinue = useCallback(
    (payload: StepContinuePayload) => {
      if (!step) return
      let rawAnswer: unknown = null
      if (payload.kind === 'text') rawAnswer = payload.textValue.trim()
      else if (payload.kind === 'single') rawAnswer = payload.selected

      // Guest survey never uses static / payment / income / debt steps, so every
      // step we hit has a `mapsTo` — narrow via the discriminant and apply it.
      const mapsTo =
        step.type === 'text' ||
        step.type === 'country_select' ||
        step.type === 'single_select' ||
        step.type === 'number' ||
        step.type === 'multi_select'
          ? step.mapsTo
          : ''
      if (payload.kind === 'text' && typeof rawAnswer === 'string') {
        applyMapsTo(mapsTo, rawAnswer, updateProfile, updateSettings)
        if (mapsTo === 'profile.country' || mapsTo === 'profile.city') {
          applyLocaleFromProfile()
        }
      }
      if (payload.kind === 'single' && typeof rawAnswer === 'string') {
        applyMapsTo(mapsTo, rawAnswer, updateProfile, updateSettings)
      }

      setAnswers((prev) => ({ ...prev, [step.id]: rawAnswer }))

      if (isLast) finish()
      else setIndex((i) => i + 1)
    },
    [finish, isLast, step, updateProfile, updateSettings],
  )

  if (mode !== 'guest' || !step) return null

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-brand-bg)]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-brand-border)]">
        <button
          type="button"
          onClick={() => (index > 0 ? setIndex((i) => i - 1) : undefined)}
          disabled={index === 0}
          className="flex items-center gap-1 text-sm text-[var(--color-brand-text-muted)] disabled:opacity-40"
          aria-label={t.common.back}
        >
          {locale === 'ar' ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
          <span>{t.common.back}</span>
        </button>
        <div className="text-xs text-[var(--color-brand-text-muted)] font-medium">
          {t.onboarding.stepOfTotal(index + 1, steps.length)}
        </div>
        <button
          type="button"
          onClick={() => {
            void endGuest()
          }}
          className="text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-red)]"
        >
          {t.guest.exitGuest}
        </button>
      </header>
      <main className="flex-1 flex items-stretch justify-center p-4 pb-10">
        <OnboardingStepForm
          key={step.id}
          step={step}
          initialText={initialTextForStep(step)}
          initialSelected={initialSelectedForStep(step)}
          initialMulti={[]}
          initialPaymentDrafts={[]}
          initialIncomeEntries={[]}
          initialDebtEntries={[]}
          loadError={null}
          isLastSurveyStep={isLast}
          finishing={false}
          planLoading={false}
          onContinue={handleContinue}
        />
      </main>
    </div>
  )
}
