'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CountrySelect } from '@/components/ui/CountrySelect'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { OnboardingJourneyProgress } from '@/components/onboarding/OnboardingJourneyProgress'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useLocale, useT } from '@/lib/i18n'
import {
  CORE_GATE_CURRENCIES,
  CORE_GATE_STEPS,
  createEmptyCoreGateAnswers,
  isCoreGateStepComplete,
  type CoreGateAnswers,
  type CoreGateStepId,
} from '@/lib/onboarding/coreGateConfig'
import { AUTH_EVENTS, ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import type { Currency } from '@/lib/store/types'

const REFRESH_RETRY_BUDGET = 3
const REFRESH_RETRY_DELAY_MS = 200

/**
 * Four-step core-onboarding stepper used when `NEXT_PUBLIC_PROGRESSIVE_ONBOARDING=1`.
 *
 * Replaces the 27-step expert survey: we collect only what the app needs to
 * render (name, country, city, base currency). Everything else is drip-fed
 * via the dashboard first-run checklist.
 */
export function CoreOnboardingView() {
  const t = useT()
  const { locale } = useLocale()
  const router = useRouter()
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)

  const [answers, setAnswers] = useState<CoreGateAnswers>(() => ({
    ...createEmptyCoreGateAnswers(),
    display_name: profile.name || '',
    country: profile.country || '',
    city: profile.city || '',
    base_currency: (settings.baseCurrency as Currency) || 'AED',
  }))
  const [index, setIndex] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const firedStartRef = useRef(false)
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  const total = CORE_GATE_STEPS.length
  const step = CORE_GATE_STEPS[index]
  const isLast = index === total - 1
  const canAdvance = step ? isCoreGateStepComplete(step.id, answers) : false

  useEffect(() => {
    if (firedStartRef.current) return
    firedStartRef.current = true
    track(ONBOARDING_EVENTS.coreGateStart)
  }, [])

  // Focus the first input on every step change.
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [index])

  const setAnswer = useCallback(
    <K extends CoreGateStepId>(id: K, value: CoreGateAnswers[K]) => {
      setAnswers((prev) => ({ ...prev, [id]: value }))
    },
    [],
  )

  const goBack = useCallback(() => {
    if (index <= 0) return
    setIndex((i) => Math.max(0, i - 1))
  }, [index])

  const finish = useCallback(async () => {
    setFinishing(true)
    setFinishError(null)

    // Persist answers locally first so the dashboard has data even if the
    // network round-trip fails.
    updateProfile({
      name: answers.display_name.trim(),
      country: answers.country.trim(),
      city: answers.city.trim(),
      baseCurrency: answers.base_currency,
    })
    updateSettings({ baseCurrency: answers.base_currency })

    track(ONBOARDING_EVENTS.coreGateCompleted, {
      country: answers.country,
      currency: answers.base_currency,
    })
    track(AUTH_EVENTS.emailStateResolved, { flow: 'core_gate_finish' })

    const supabase = createClient()
    try {
      const res = await fetch('/api/auth/complete-core-onboarding', { method: 'POST' })
      if (!res.ok) {
        console.error('[core-gate] complete-core-onboarding returned', res.status)
      }
    } catch (e) {
      console.error('[core-gate] complete-core-onboarding fetch failed', e)
    }

    // Retry refreshSession with tiny backoff so the fresh user_metadata is
    // reflected in the next middleware hit; otherwise the user bounces back
    // into /onboarding in an infinite loop.
    let refreshed = false
    for (let attempt = 0; attempt < REFRESH_RETRY_BUDGET; attempt++) {
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data.user?.user_metadata?.onboarding_completed === true) {
          refreshed = true
          break
        }
      } catch (e) {
        console.error('[core-gate] refreshSession failed', e)
      }
      await new Promise((r) => setTimeout(r, REFRESH_RETRY_DELAY_MS))
    }

    if (!refreshed) {
      console.warn('[core-gate] session did not reflect onboarding_completed after retries; navigating anyway')
    }

    router.refresh()
    router.replace('/')
  }, [answers, router, updateProfile, updateSettings])

  const goNext = useCallback(() => {
    if (!step || !canAdvance) return
    track(ONBOARDING_EVENTS.coreGateStepAdvanced, { step: step.id, index })
    if (isLast) {
      void finish()
      return
    }
    setIndex((i) => Math.min(total - 1, i + 1))
  }, [step, canAdvance, isLast, index, total, finish])

  if (!step) return null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-[var(--color-brand-bg)] border-b border-[var(--color-brand-border)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            {index > 0 ? (
              <button
                type="button"
                onClick={goBack}
                aria-label={t.onboarding.backStep}
                className="inline-flex items-center justify-center w-10 h-10 -ms-2 rounded-lg text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden />
              </button>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[var(--color-brand-text-primary)] font-heading truncate">
                {t.onboarding.coreGateTitle}
              </h1>
              <p className="text-[11px] text-[var(--color-brand-text-muted)]">
                {t.onboarding.stepOfTotal(index + 1, total)}
              </p>
            </div>
          </div>
          <LanguageToggle size="sm" />
        </div>
        <div className="px-4 pb-3 lg:px-8">
          <OnboardingJourneyProgress totalSteps={total} currentIndex={index} phase="survey" />
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-md space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-3"
            >
              {step.id === 'display_name' ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brand-text-primary)] mb-1">
                    {t.onboarding.coreGateStepName}
                  </label>
                  <p className="text-xs text-[var(--color-brand-text-muted)] mb-3">
                    {t.onboarding.coreGateStepNameHelp}
                  </p>
                  <input
                    ref={firstInputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={answers.display_name}
                    onChange={(e) => setAnswer('display_name', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canAdvance) goNext()
                    }}
                    placeholder={t.onboarding.coreGateStepNamePlaceholder}
                    className="w-full h-11 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] outline-none transition-colors focus:border-[var(--color-brand-red)]"
                    autoComplete="given-name"
                  />
                </div>
              ) : step.id === 'country' ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brand-text-primary)] mb-1">
                    {t.onboarding.coreGateStepCountry}
                  </label>
                  <p className="text-xs text-[var(--color-brand-text-muted)] mb-3">
                    {t.onboarding.coreGateStepCountryHelp}
                  </p>
                  <CountrySelect
                    value={answers.country}
                    onChange={(name) => setAnswer('country', name)}
                    locale={locale}
                    placeholder={t.profile.placeholderCountrySelect}
                    className="w-full h-11 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] outline-none transition-colors focus:border-[var(--color-brand-red)]"
                  />
                </div>
              ) : step.id === 'city' ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brand-text-primary)] mb-1">
                    {t.onboarding.coreGateStepCity}
                  </label>
                  <p className="text-xs text-[var(--color-brand-text-muted)] mb-3">
                    {t.onboarding.coreGateStepCityHelp}
                  </p>
                  <input
                    ref={firstInputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={answers.city}
                    onChange={(e) => setAnswer('city', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canAdvance) goNext()
                    }}
                    placeholder={t.onboarding.coreGateStepCityPlaceholder}
                    className="w-full h-11 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] outline-none transition-colors focus:border-[var(--color-brand-red)]"
                    autoComplete="address-level2"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-brand-text-primary)] mb-1">
                    {t.onboarding.coreGateStepCurrency}
                  </label>
                  <p className="text-xs text-[var(--color-brand-text-muted)] mb-3">
                    {t.onboarding.coreGateStepCurrencyHelp}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {CORE_GATE_CURRENCIES.map((c, i) => {
                      const active = answers.base_currency === c
                      return (
                        <button
                          key={c}
                          ref={i === 0 ? (firstInputRef as unknown as React.RefObject<HTMLButtonElement>) : undefined}
                          type="button"
                          onClick={() => setAnswer('base_currency', c)}
                          className={
                            'h-11 rounded-xl border text-sm transition-colors ' +
                            (active
                              ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                              : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]')
                          }
                        >
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {finishError ? (
            <p role="alert" className="text-xs text-[var(--color-brand-red)]">
              {finishError}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!canAdvance || finishing}
            onClick={goNext}
            className="w-full h-11 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-brand-red-hover)] transition-colors flex items-center justify-center gap-2"
          >
            {finishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                <span>{t.onboarding.coreGateFinishingCta}</span>
              </>
            ) : isLast ? (
              t.onboarding.coreGateFinishCta
            ) : (
              t.onboarding.coreGateNextCta
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
