'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList } from 'lucide-react'
import { PAGE_HEADER_BARE_CLASS } from '@/components/layout/PageHeader'
import { OnboardingJourneyProgress } from '@/components/onboarding/OnboardingJourneyProgress'
import { OnboardingStepForm, type StepContinuePayload } from '@/components/onboarding/OnboardingStepForm'
import { OnboardingPlanPicker } from '@/components/onboarding/OnboardingPlanPicker'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { AppSettings, OnboardingAiPlan, UserProfile } from '@/lib/store/types'
import {
  parseDebtEntriesAnswer,
  parseIncomeEntriesAnswer,
  valueForMultiStep,
  valueForNumberStep,
  valueForPaymentStep,
  valueForSingleStep,
  valueForTextStep,
} from '@/lib/onboarding/onboardingPageHelpers'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

export interface OnboardingPageViewProps {
  answersReady: boolean
  step: SurveyStep | undefined
  phase: 'survey' | 'plans'
  index: number
  surveyTotal: number
  isLastSurveyStep: boolean
  finishing: boolean
  planLoading: boolean
  loadError: string | null
  handleStepContinue: (payload: StepContinuePayload) => void | Promise<void>
  finishOnboarding: (plan: OnboardingAiPlan | null) => void | Promise<void>
  plans: OnboardingAiPlan[] | null
  valNotes: string[] | null | undefined
  storeSnap: typeof useFinanceStore.getState
  profile: UserProfile
  settings: AppSettings
  answers: Record<string, unknown>
  redo: boolean
  router: { push: (href: string) => void; refresh: () => void; replace: (href: string) => void }
}

export function OnboardingPageView({
  answersReady,
  step,
  phase,
  index,
  surveyTotal,
  isLastSurveyStep,
  finishing,
  planLoading,
  loadError,
  handleStepContinue,
  finishOnboarding,
  plans,
  valNotes,
  storeSnap,
  profile,
  settings,
  answers,
  redo,
  router,
}: OnboardingPageViewProps) {
  const t = useT()
  const o = t.onboarding

  if (!answersReady || !step) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white">
        <p className="text-sm text-[var(--color-brand-text-muted)]">{o.loadingMessage}</p>
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
                <h1 className="text-lg font-bold text-white font-heading">{o.pageTitle}</h1>
                <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-snug">
                  {phase === 'plans' ? o.subtitlePlans : redo ? o.subtitleRedo : o.subtitleDefault}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {index === 0 && phase === 'survey' ? <LanguageToggle size="sm" /> : null}
              {phase === 'survey' ? (
                <button
                  type="button"
                  disabled={finishing || planLoading}
                  onClick={() => void finishOnboarding(null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:text-white hover:bg-[var(--color-brand-elevated)] disabled:opacity-40 transition-colors"
                >
                  {o.skipButton}
                </button>
              ) : null}
              {redo ? (
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="text-xs text-[var(--color-brand-text-secondary)] hover:text-white"
                >
                  {o.backToProfile}
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
              <p className="text-sm text-[var(--color-brand-text-secondary)]">{o.plansLoadError}</p>
              <button
                type="button"
                onClick={() => void finishOnboarding(null)}
                disabled={finishing}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {finishing ? o.continueWithoutPlanBusy : o.continueWithoutPlan}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
