'use client'

import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { PAGE_HEADER_BARE_CLASS } from '@/components/layout/PageHeader'
import { OnboardingJourneyProgress } from '@/components/onboarding/OnboardingJourneyProgress'
import { OnboardingStepForm, type StepContinuePayload } from '@/components/onboarding/OnboardingStepForm'
import { BuddgyBuilderFlow } from '@/components/features/budget-planner/BuddgyBuilderFlow'
import type { SurveyStep } from '@/lib/onboarding/surveyConfig'
import type { AppSettings, UserProfile } from '@/lib/store/types'
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
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

export interface OnboardingPageViewProps {
  answersReady: boolean
  step: SurveyStep | undefined
  phase: 'survey' | 'buddgy'
  index: number
  surveyTotal: number
  isLastSurveyStep: boolean
  finishing: boolean
  loadError: string | null
  handleStepContinue: (payload: StepContinuePayload) => void | Promise<void>
  finishOnboarding: () => void | Promise<void>
  storeSnap: typeof useFinanceStore.getState
  profile: UserProfile
  settings: AppSettings
  answers: Record<string, unknown>
  redo: boolean
  router: { push: (href: string) => void; refresh: () => void; replace: (href: string) => void }
  goBack: () => void
  canGoBack: boolean
  ensureBuddgyPlanId: () => string
}

export function OnboardingPageView({
  answersReady,
  step,
  phase,
  index,
  surveyTotal,
  isLastSurveyStep,
  finishing,
  loadError,
  handleStepContinue,
  finishOnboarding,
  storeSnap,
  profile,
  settings,
  answers,
  redo,
  router,
  goBack,
  canGoBack,
  ensureBuddgyPlanId,
}: OnboardingPageViewProps) {
  const t = useT()
  const { locale } = useLocale()
  const o = t.onboarding
  const BackIcon = locale === 'ar' ? ChevronRight : ChevronLeft

  // Stable plan id for Buddgy once the user enters the buddgy phase.
  const buddgyPlanId = useMemo(() => {
    if (phase !== 'buddgy') return null
    return ensureBuddgyPlanId()
  }, [phase, ensureBuddgyPlanId])

  if (!answersReady || !step) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-[var(--color-brand-text-primary)]">
        <p className="text-sm text-[var(--color-brand-text-muted)]">{o.loadingMessage}</p>
      </div>
    )
  }

  const currentProgressIndex = phase === 'buddgy' ? surveyTotal - 1 : index
  const progressPhase: 'survey' | 'plans' = phase === 'buddgy' ? 'plans' : 'survey'

  return (
    <div className="min-h-screen flex flex-col">
      <header className={PAGE_HEADER_BARE_CLASS}>
        <div className="flex flex-col gap-2 px-4 py-3 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              {canGoBack ? (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={o.backStep}
                  className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] -ms-2 -mt-1 rounded-lg text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                >
                  <BackIcon className="w-5 h-5" aria-hidden />
                </button>
              ) : (
                <ClipboardList className="w-5 h-5 text-[var(--color-brand-red)] shrink-0 mt-0.5" aria-hidden />
              )}
              <div className={cn('min-w-0', locale === 'ar' && 'text-end')}>
                <h1 className="text-lg font-bold text-[var(--color-brand-text-primary)] font-heading">{o.pageTitle}</h1>
                <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-snug">
                  {phase === 'buddgy' ? o.subtitlePlans : redo ? o.subtitleRedo : o.subtitleDefault}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {index === 0 && phase === 'survey' ? <LanguageToggle size="sm" /> : null}
              {phase === 'survey' ? (
                <button
                  type="button"
                  disabled={finishing}
                  onClick={() => void finishOnboarding()}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] disabled:opacity-40 transition-colors"
                >
                  {o.skipButton}
                </button>
              ) : null}
              {redo ? (
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  className="text-xs text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
                >
                  {o.backToProfile}
                </button>
              ) : null}
            </div>
          </div>
          <OnboardingJourneyProgress
            totalSteps={surveyTotal}
            currentIndex={currentProgressIndex}
            phase={progressPhase}
          />
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
              loadError={loadError}
              isLastSurveyStep={isLastSurveyStep}
              finishing={finishing}
              planLoading={false}
              onContinue={handleStepContinue}
            />
          ) : buddgyPlanId ? (
            <motion.div
              key="buddgy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl self-center"
            >
              <BuddgyBuilderFlow
                planId={buddgyPlanId}
                onClose={() => void finishOnboarding()}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
