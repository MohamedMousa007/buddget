'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { BuddgyAvatar } from '@/components/illustrations/BuddgyAvatar'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { ensureBudgetPlanId } from '@/lib/budget/ensureBudgetPlanId'
import { applyBudgetPlan } from '@/lib/budget/applyBudgetPlan'
import { flushFinanceNow } from '@/components/sync/SupabaseFinanceSync'
import { buildAiPlanContext } from '@/lib/onboarding/buildAiPlanContext'
import { generateJourneyPlan, type JourneyPlanResult } from '@/lib/onboarding/generateJourneyPlan'
import type { JourneyAnswers } from '@/lib/onboarding/journeyTypes'
import { JOURNEY_EVENTS, track } from '@/lib/analytics/events'

/**
 * Terminal Journey card: runs the single AI plan call, applies the
 * returned (or preset-fallback) categories to the active plan, flips
 * `user_metadata.onboarding_completed`, then hands off to
 * `/budget-setup?tour=1&freshPlan=1` where SP6's tour will auto-fire.
 *
 * Idempotent under tab-close: if the user reloads mid-flight we re-run
 * the pipeline from scratch; `applyBudgetPlan` replaces plan categories
 * atomically and `/api/auth/complete-journey` short-circuits when the
 * flag is already set.
 *
 * Theatrical minimum of 2.5 s so the transition doesn't feel jarring.
 * After 10 s we surface a soft status message; at 18 s we abandon the
 * AI call and apply the preset seed so users can never be stuck on
 * this screen.
 */
const MIN_DISPLAY_MS = 2500
const SOFT_TIMEOUT_MS = 10_000
const HARD_TIMEOUT_MS = 18_000

type Phase = 'working' | 'succeeded' | 'softTimeout' | 'failed'

export function BuildingPlanScreen() {
  const t = useT()
  const router = useRouter()
  const firedOnceRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('working')
  const [bulletIdx, setBulletIdx] = useState(0)

  const { answers, country } = useFinanceStore(
    useShallow((s) => ({
      answers: s.onboardingState.answers as unknown as JourneyAnswers,
      country: (s.onboardingState.answers as unknown as JourneyAnswers)
        ?.identity?.country ?? s.profile.country ?? null,
    })),
  )

  const bullets = useMemo(
    () => [
      t.onboarding.journey.loading.bullets.income,
      t.onboarding.journey.loading.bullets.debts,
      t.onboarding.journey.loading.bullets.anchors(country ?? '—'),
      t.onboarding.journey.loading.bullets.drafting,
    ],
    [t, country],
  )

  // Cycle bullets every ~700 ms while working.
  useEffect(() => {
    if (phase !== 'working') return
    const h = window.setInterval(() => {
      setBulletIdx((i) => (i + 1) % bullets.length)
    }, 700)
    return () => window.clearInterval(h)
  }, [phase, bullets.length])

  // One-shot pipeline.
  useEffect(() => {
    if (firedOnceRef.current) return
    firedOnceRef.current = true

    const startedAt = Date.now()
    let softTimer: number | null = null
    let cancelled = false

    async function run() {
      const state = useFinanceStore.getState()
      const monthlyIncome = calculateMonthlyIncome(
        state.incomeSources,
        state.settings.baseCurrency,
        state.exchangeRates,
      )

      const typedAnswers = answers ?? (state.onboardingState.answers as unknown as JourneyAnswers)

      const context = buildAiPlanContext({
        answers: typedAnswers,
        monthlyIncomeInBase: Math.max(0, monthlyIncome),
        baseCurrency: state.settings.baseCurrency,
        counts: {
          paymentMethods: state.paymentMethods.length,
          incomeSources: state.incomeSources.length,
          debts: state.debts.length,
          subscriptions: state.subscriptions.length,
          savingsAccounts: state.savingsAccounts.length,
          goals: state.goals.length,
        },
        primaryGoalName: state.goals[0]?.name,
        primaryGoalCategory: state.goals[0]?.category,
      })

      softTimer = window.setTimeout(() => {
        if (!cancelled) setPhase((p) => (p === 'working' ? 'softTimeout' : p))
      }, SOFT_TIMEOUT_MS)

      // Hard-timeout wrapper: if Gemini hangs past HARD_TIMEOUT_MS we
      // swap to the preset seed so the user is never stranded. The
      // preset is already what `generateJourneyPlan` would fall back
      // to on error — racing the promise just lets us fail faster.
      const hardTimeout = new Promise<JourneyPlanResult>((resolve) => {
        window.setTimeout(() => {
          resolve({
            categories: context.initialCategories,
            source: 'preset',
            error: 'hard_timeout',
          })
        }, HARD_TIMEOUT_MS)
      })
      const result = await Promise.race([generateJourneyPlan(context), hardTimeout])

      const planId = ensureBudgetPlanId(() => useFinanceStore.getState())
      try {
        applyBudgetPlan(() => useFinanceStore.getState(), {
          planId,
          categories: result.categories,
          currency: state.settings.baseCurrency,
          financialGoalsNotes: context.feedback,
        })
      } catch (e) {
        console.error('[BuildingPlanScreen] applyBudgetPlan failed', e)
      }

      // Flush to Supabase immediately after the local apply so a
      // tab-close during the theatrical min-display doesn't leave the
      // plan only in localStorage. Do this BEFORE the min-display
      // wait — durability > theatre.
      try {
        await flushFinanceNow()
      } catch (e) {
        console.warn('[BuildingPlanScreen] flushFinanceNow failed', e)
      }

      // Theatrical minimum: hold the bullets on screen a beat longer
      // if the AI came back fast. Purely cosmetic now that data is
      // already durable.
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise((r) => window.setTimeout(r, MIN_DISPLAY_MS - elapsed))
      }

      // Flip the auth flag. Failure here is recoverable — the next app
      // open re-runs this screen since `onboarding_completed` is still
      // false, and the idempotent API + applyBudgetPlan won't duplicate.
      let completed = false
      try {
        const res = await fetch('/api/auth/complete-journey', { method: 'POST' })
        completed = res.ok
        if (!res.ok) {
          console.error('[BuildingPlanScreen] complete-journey', await res.text())
        }
      } catch (e) {
        console.error('[BuildingPlanScreen] complete-journey network', e)
      }

      if (cancelled) return

      if (softTimer) window.clearTimeout(softTimer)

      if (!completed) {
        setPhase('failed')
        return
      }

      track(JOURNEY_EVENTS.completed, {
        source: result.source,
        durationMs: Date.now() - startedAt,
      })
      setPhase('succeeded')
      // Hand off. `freshPlan=1` tells budget-setup to welcome with the
      // plan already applied; `tour=1` will trigger SP6's guided tour.
      router.replace('/budget-setup?tour=1&freshPlan=1')
    }

    run().catch((e) => {
      console.error('[BuildingPlanScreen] pipeline crashed', e)
      if (!cancelled) setPhase('failed')
    })

    return () => {
      cancelled = true
      if (softTimer) window.clearTimeout(softTimer)
    }
  }, [answers, router])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
      <div
        className={cn(
          'relative flex items-center justify-center',
          'rounded-full',
          'shadow-[0_0_60px_rgba(255,91,91,0.28)]',
        )}
        aria-hidden
      >
        {phase === 'succeeded' ? (
          <>
            <BuddgyAvatar pose="celebrating" size="lg" />
            <motion.span
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 16, stiffness: 280 }}
            >
              <div className="rounded-full bg-[var(--color-brand-green)] p-1.5 translate-x-[48px] translate-y-[-40px]">
                <Check className="h-4 w-4 text-white" />
              </div>
            </motion.span>
          </>
        ) : (
          <BuddgyAvatar pose="thinking" size="lg" />
        )}
      </div>

      <h2 className="text-xl font-semibold text-[var(--color-brand-text-primary)]">
        {t.onboarding.journey.loading.title}
      </h2>

      <ul className="w-full max-w-sm space-y-2 text-left">
        {bullets.map((line, i) => {
          const active = phase === 'working' ? i === bulletIdx : true
          const done = phase !== 'working' || i < bulletIdx
          return (
            <li
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]'
                  : 'text-[var(--color-brand-text-muted)]',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'h-5 w-5 flex items-center justify-center rounded-full shrink-0',
                  done
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text-muted)]',
                )}
                aria-hidden
              >
                {done ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
              </span>
              <span>{line}</span>
            </li>
          )
        })}
      </ul>

      <AnimatePresence>
        {phase === 'softTimeout' && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-[var(--color-brand-text-muted)] max-w-xs"
          >
            {t.onboarding.journey.loading.softTimeout}
          </motion.p>
        )}
        {phase === 'failed' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <p className="text-sm text-[var(--color-brand-text-secondary)] max-w-xs">
              {t.onboarding.journey.loading.failed}
            </p>
            <button
              type="button"
              onClick={() => {
                firedOnceRef.current = false
                setPhase('working')
                setBulletIdx(0)
              }}
              className="h-10 px-5 rounded-full text-sm font-semibold bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white"
            >
              {t.onboarding.journey.loading.retry}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
