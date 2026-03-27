'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { parseSurveyConfig, type SurveyConfig } from '@/lib/onboarding/surveyConfig'
import { EXPERT_ONBOARDING_CONFIG } from '@/lib/onboarding/expertSurveyConfig'
import { expertSurveyStepCount } from '@/lib/onboarding/onboardingProgress'
import { mergeOnboardingAnswers, deriveAnswersFromFinanceStore } from '@/lib/onboarding/onboardingPrefill'
import type {
  AppSettings,
  Currency,
  IncomeSource,
  OnboardingAiPlan,
  OnboardingPaymentDraft,
  UserProfile,
} from '@/lib/store/types'
import type { DebtOnboardingPayload } from '@/components/onboarding/DebtOnboardingPanel'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { PAGE_HEADER_BARE_CLASS } from '@/components/layout/PageHeader'
import { OnboardingJourneyProgress } from '@/components/onboarding/OnboardingJourneyProgress'
import { OnboardingStepForm, type StepContinuePayload } from '@/components/onboarding/OnboardingStepForm'
import { OnboardingPlanPicker } from '@/components/onboarding/OnboardingPlanPicker'

function applyMapsTo(
  mapsTo: string,
  value: string,
  updateProfile: (u: Partial<UserProfile>) => void,
  updateSettings: (u: Partial<AppSettings>) => void
) {
  if (mapsTo === 'profile.name') {
    updateProfile({ name: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'profile.country') {
    updateProfile({ country: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'profile.city') {
    updateProfile({ city: value.slice(0, 120) })
    return
  }
  if (mapsTo === 'settings.baseCurrency') {
    updateSettings({ baseCurrency: value as Currency })
    return
  }
  if (mapsTo === 'settings.secondaryCurrency') {
    if (value === 'none') {
      updateSettings({ secondaryCurrency: null, showSecondaryCurrency: false })
    } else {
      updateSettings({
        secondaryCurrency: value as Currency,
        showSecondaryCurrency: true,
      })
    }
  }
}

function applyIncomeFromOnboarding(entries: Omit<IncomeSource, 'id' | 'createdAt'>[]) {
  const st = useFinanceStore.getState()
  const { deleteIncomeSource, addIncomeSource, updateSettings } = st
  for (const s of st.incomeSources) {
    if (s.name === 'Primary income') deleteIncomeSource(s.id)
  }
  if (entries.length === 0) {
    const st2 = useFinanceStore.getState()
    const m = calculateMonthlyIncome(
      st2.incomeSources,
      st2.settings.baseCurrency,
      st2.exchangeRates
    )
    updateSettings({ noIncomeDeclared: m <= 0 })
    return
  }
  const ids = [...useFinanceStore.getState().incomeSources.map((s) => s.id)]
  for (const id of ids) deleteIncomeSource(id)
  for (const e of entries) addIncomeSource({ ...e })
  updateSettings({ noIncomeDeclared: false })
}

function applyDebtFromOnboarding(entries: DebtOnboardingPayload['entries']) {
  if (entries.length === 0) return
  const st = useFinanceStore.getState()
  const { deleteDebt, addDebt } = st
  const ids = [...st.debts.map((d) => d.id)]
  for (const id of ids) deleteDebt(id)
  for (const e of entries) addDebt(e)
}

function applyPaymentDrafts(redo: boolean, drafts: OnboardingPaymentDraft[], base: Currency) {
  const colors = ['#f87171', '#94a3b8', '#34d399', '#a78bfa', '#fbbf24', '#fb923c']
  const { paymentMethods, addPaymentMethod } = useFinanceStore.getState()
  const existing = new Set(paymentMethods.map((m) => m.name.toLowerCase().trim()))
  drafts.forEach((d, idx) => {
    const name = d.nickname.trim()
    if (!name) return
    const key = name.toLowerCase()
    if (existing.has(key)) return
    addPaymentMethod({
      name,
      type: d.type,
      currency: base,
      color: colors[idx % colors.length],
      isDefault: !redo && idx === 0,
    })
    existing.add(key)
  })
}

function pickSurveyConfig(remote: unknown): SurveyConfig {
  const parsed = parseSurveyConfig(remote)
  if (parsed?.steps?.some((s) => s.id === 'pre_plan')) return parsed
  return EXPERT_ONBOARDING_CONFIG
}

function valueForTextStep(stepId: string, answers: Record<string, unknown>, profile: UserProfile): string {
  const a = answers[stepId]
  if (typeof a === 'string') return a
  if (stepId === 'display_name') return profile.name ?? ''
  if (stepId === 'country') return profile.country ?? ''
  if (stepId === 'city') return profile.city ?? ''
  return ''
}

function valueForNumberStep(stepId: string, answers: Record<string, unknown>): string {
  const a = answers[stepId]
  if (typeof a === 'number') return String(a)
  if (typeof a === 'string' && a.trim()) return a
  return ''
}

function parseIncomeEntriesAnswer(raw: unknown): Omit<IncomeSource, 'id' | 'createdAt'>[] {
  if (!raw || typeof raw !== 'object' || !('entries' in raw)) return []
  const e = (raw as { entries: unknown }).entries
  if (!Array.isArray(e)) return []
  return e as Omit<IncomeSource, 'id' | 'createdAt'>[]
}

function parseDebtEntriesAnswer(raw: unknown): DebtOnboardingPayload['entries'] {
  if (!raw || typeof raw !== 'object' || !('entries' in raw)) return []
  const e = (raw as { entries: unknown }).entries
  if (!Array.isArray(e)) return []
  return e as DebtOnboardingPayload['entries']
}

function valueForSingleStep(stepId: string, answers: Record<string, unknown>, store: ReturnType<typeof useFinanceStore.getState>): string | null {
  const a = answers[stepId]
  if (typeof a === 'string') return a
  if (stepId === 'base_currency') return store.settings.baseCurrency
  if (stepId === 'secondary_currency') {
    return store.settings.secondaryCurrency ?? 'none'
  }
  return null
}

function valueForMultiStep(stepId: string, answers: Record<string, unknown>): string[] {
  const a = answers[stepId]
  if (Array.isArray(a) && a.every((x) => typeof x === 'string')) return a as string[]
  return []
}

function valueForPaymentStep(answers: Record<string, unknown>): OnboardingPaymentDraft[] {
  const a = answers.payment_methods
  if (Array.isArray(a)) {
    return a.filter(
      (x): x is OnboardingPaymentDraft =>
        typeof x === 'object' &&
        x !== null &&
        'nickname' in x &&
        'type' in x &&
        'preset' in x
    ) as OnboardingPaymentDraft[]
  }
  return []
}

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redo = searchParams.get('redo') === '1'

  const supabase = useMemo(() => createClient(), [])
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const setBudgetCategories = useFinanceStore((s) => s.setBudgetCategories)
  const setOnboardingState = useFinanceStore((s) => s.setOnboardingState)
  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)

  const [config, setConfig] = useState<SurveyConfig>(EXPERT_ONBOARDING_CONFIG)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'survey' | 'plans'>('survey')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [answersReady, setAnswersReady] = useState(false)

  const [finishing, setFinishing] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const full = useFinanceStore.getState()
    const derived = deriveAnswersFromFinanceStore(full)
    const merged = mergeOnboardingAnswers(full.onboardingState.answers, derived)
    setAnswers(merged)
    const maxI = Math.min(
      full.onboardingState.currentStepIndex,
      EXPERT_ONBOARDING_CONFIG.steps.length - 1
    )
    setIndex(Number.isFinite(maxI) && maxI >= 0 ? maxI : 0)
    if (full.onboardingState.aiPlans && full.onboardingState.aiPlans.length >= 1 && !full.onboardingState.planAccepted) {
      setPhase('plans')
    }
    setAnswersReady(true)
  }, [redo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('onboarding_survey_config')
        .select('config')
        .eq('published', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setConfig(EXPERT_ONBOARDING_CONFIG)
        return
      }
      setConfig(pickSurveyConfig(data?.config))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const steps = config.steps
  const step = steps[index]
  const surveyTotal = expertSurveyStepCount()
  const isLastSurveyStep = step?.id === 'pre_plan'

  const persistAnswers = useCallback(
    (next: Record<string, unknown>, nextIndex: number) => {
      setAnswers(next)
      setOnboardingState({
        answers: next,
        currentStepIndex: nextIndex,
      })
    },
    [setOnboardingState]
  )

  const requestPlans = useCallback(
    async (nextAnswers: Record<string, unknown>) => {
      setPlanLoading(true)
      try {
        const country = String(nextAnswers.country || profile.country || '').trim() || 'Unknown'
        const city = String(nextAnswers.city || profile.city || '').trim() || 'Unknown'
        const base = (nextAnswers.base_currency as Currency) || settings.baseCurrency
        const st = useFinanceStore.getState()
        const monthlyTakeHome = calculateMonthlyIncome(st.incomeSources, base, st.exchangeRates)

        const res = await fetch('/api/onboarding/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country,
            city,
            currency: base,
            monthlyTakeHome,
            answers: nextAnswers,
          }),
        })
        const data = await res.json()
        const plans = (data.plans || []) as OnboardingAiPlan[]
        const notes = (data.validationNotes || []) as string[]
        if (!res.ok || plans.length < 1) {
          setOnboardingState({
            lastValidationNotes: [data.error || 'Could not load plans.'],
            aiPlans: null,
          })
          setPhase('plans')
          return
        }
        setOnboardingState({
          aiPlans: plans.slice(0, 3),
          lastValidationNotes: notes,
          aiGeneratedAt: new Date().toISOString(),
          selectedPlanIndex: 0,
        })
        setPhase('plans')
      } finally {
        setPlanLoading(false)
      }
    },
    [profile.country, profile.city, settings.baseCurrency, setOnboardingState]
  )

  const finishOnboarding = useCallback(
    async (plan: OnboardingAiPlan | null) => {
      setFinishing(true)
      try {
        const base = useFinanceStore.getState().settings.baseCurrency
        const monthly = calculateMonthlyIncome(
          useFinanceStore.getState().incomeSources,
          base,
          useFinanceStore.getState().exchangeRates
        )

        if (plan) {
          const p = plan.percents
          setBudgetCategories(
            (['Rent', 'Transport', 'Food', 'Enjoyment', 'Savings', 'Debt', 'Remittance', 'Other'] as const).map(
              (category) => ({
                category,
                budgetedAmount: monthly > 0 ? (p[category] / 100) * monthly : 0,
                currency: base,
                percentOfIncome: p[category],
              })
            )
          )
          updateSettings({ budgetEntryMode: 'percent_of_income', dismissOnboardingBanner: false })
        } else {
          updateSettings({ dismissOnboardingBanner: false })
        }

        const drafts = valueForPaymentStep(answers)
        if (drafts.length > 0) {
          applyPaymentDrafts(redo, drafts, base)
        }

        setOnboardingState({
          planAccepted: true,
          selectedPlanIndex: plan ? 0 : null,
          currentStepIndex: steps.length,
        })

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user && !redo) {
          await supabase
            .from('user_profiles')
            .update({
              onboarding_completed: true,
              display_name: useFinanceStore.getState().profile.name,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)

          await supabase.auth.updateUser({
            data: { onboarding_completed: true },
          })
        }

        router.refresh()
        router.replace('/')
      } finally {
        setFinishing(false)
      }
    },
    [answers, redo, router, setBudgetCategories, setOnboardingState, steps.length, supabase, updateSettings]
  )

  const handleStepContinue = useCallback(
    async (payload: StepContinuePayload) => {
      if (!step) return

      if (payload.kind === 'income') applyIncomeFromOnboarding(payload.payload.entries)
      if (payload.kind === 'debt') applyDebtFromOnboarding(payload.payload.entries)

      let rawAnswer: unknown = null
      if (payload.kind === 'text') rawAnswer = payload.textValue.trim()
      else if (payload.kind === 'number') {
        const r = payload.textValue.replace(/,/g, '.').replace(/\.(?=.*\.)/g, '')
        rawAnswer = parseFloat(r)
      } else if (payload.kind === 'single') rawAnswer = payload.selected
      else if (payload.kind === 'multi') rawAnswer = payload.values
      else if (payload.kind === 'payment') rawAnswer = payload.drafts
      else if (payload.kind === 'income') rawAnswer = payload.payload
      else if (payload.kind === 'debt') rawAnswer = payload.payload
      else if (payload.kind === 'subscriptions') rawAnswer = payload.payload

      const nextAnswers =
        step.type === 'static' ? answers : { ...answers, [step.id]: rawAnswer }

      if (step.type === 'text' && typeof rawAnswer === 'string') {
        applyMapsTo(step.mapsTo, rawAnswer, updateProfile, updateSettings)
      }
      if (step.type === 'single_select' && typeof rawAnswer === 'string') {
        applyMapsTo(step.mapsTo, rawAnswer, updateProfile, updateSettings)
      }
      if (step.type === 'number' && step.mapsTo === 'onboarding.housingMonthly') {
        /* stored in answers only */
      }

      const nextIndex = index + 1

      if (step.id === 'pre_plan') {
        persistAnswers(nextAnswers, index)
        await requestPlans(nextAnswers)
        return
      }

      if (step.type !== 'static') {
        persistAnswers(nextAnswers, nextIndex)
      } else {
        persistAnswers(nextAnswers, nextIndex)
      }

      setIndex(nextIndex)
    },
    [answers, index, persistAnswers, requestPlans, step, updateProfile, updateSettings]
  )

  const plans = useFinanceStore((s) => s.onboardingState.aiPlans)
  const valNotes = useFinanceStore((s) => s.onboardingState.lastValidationNotes)

  const storeSnap = useFinanceStore.getState

  if (!answersReady || !step) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white">
        <p className="text-sm text-[var(--color-brand-text-muted)]">Loading onboarding…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className={PAGE_HEADER_BARE_CLASS}>
        <div className="flex flex-col gap-2 px-4 py-3 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)] shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white font-heading">Onboarding</h1>
                <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-snug">
                  {phase === 'plans'
                    ? 'Choose a starting plan — you can refine every number later.'
                    : redo
                      ? 'Update your answers anytime — we’ll refresh your suggestions from what you share.'
                      : 'A short journey so your budget matches how you earn, spend, and save.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {phase === 'survey' ? (
                <button
                  type="button"
                  disabled={finishing || planLoading}
                  onClick={() => void finishOnboarding(null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:text-white hover:bg-[var(--color-brand-elevated)] disabled:opacity-40 transition-colors"
                >
                  Set up manually
                </button>
              ) : null}
              {redo ? (
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="text-xs text-[var(--color-brand-text-secondary)] hover:text-white"
                >
                  Exit to profile
                </button>
              ) : null}
            </div>
          </div>
          {phase === 'survey' ? (
            <OnboardingJourneyProgress totalSteps={surveyTotal} currentIndex={index} phase="survey" />
          ) : (
            <OnboardingJourneyProgress totalSteps={surveyTotal} currentIndex={surveyTotal - 1} phase="plans" />
          )}
        </div>
      </header>

      <div className="flex-1 flex items-stretch justify-center p-4 pb-10">
        <AnimatePresence mode="wait">
          {phase === 'survey' ? (
            <OnboardingStepForm
              key={step.id}
              step={step}
              initialText={
                step.type === 'number'
                  ? valueForNumberStep(step.id, answers)
                  : valueForTextStep(step.id, answers, profile)
              }
              initialSelected={valueForSingleStep(step.id, answers, storeSnap())}
              initialMulti={valueForMultiStep(step.id, answers)}
              initialPaymentDrafts={valueForPaymentStep(answers)}
              initialIncomeEntries={parseIncomeEntriesAnswer(answers.income_entries)}
              initialDebtEntries={parseDebtEntriesAnswer(answers.debt_entries)}
              initialSubscriptionRaw={answers.subscriptions_detail}
              baseCurrency={settings.baseCurrency}
              loadError={loadError}
              isLastSurveyStep={isLastSurveyStep}
              finishing={finishing}
              planLoading={planLoading}
              onContinue={handleStepContinue}
            />
          ) : plans && plans.length > 0 ? (
            <motion.div key="plans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex justify-center">
              <OnboardingPlanPicker
                plans={plans}
                validationNotes={valNotes ?? []}
                busy={finishing}
                onAccept={(p) => void finishOnboarding(p)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-2xl p-6 max-w-md text-center space-y-4"
            >
              <p className="text-sm text-[var(--color-brand-text-secondary)]">
                Plans could not be loaded. You can finish and set budgets on your Profile.
              </p>
              <button
                type="button"
                onClick={() => void finishOnboarding(null)}
                disabled={finishing}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {finishing ? 'Saving…' : 'Finish without AI plan'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
