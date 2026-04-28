'use client'

import { useCallback } from 'react'
import type { ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnboardingStepper } from '@/hooks/useOnboardingStepper'
import { cn } from '@/lib/utils'
import type { StepId } from '@/lib/onboarding/steps'
import type { OnboardingStepProps } from '@/lib/onboarding/onboardingDraft'
import {
  applyOnboardingStepperDraft,
  ONBOARDING_COMPLETE_KEY,
} from '@/lib/onboarding/applyOnboardingStepperDraft'
import { StepWelcome } from '@/components/onboarding/steps/StepWelcome'
import { StepLocation } from '@/components/onboarding/steps/StepLocation'
import { StepIncome } from '@/components/onboarding/steps/StepIncome'
import { StepFixedCosts } from '@/components/onboarding/steps/StepFixedCosts'
import { StepSubscriptions } from '@/components/onboarding/steps/StepSubscriptions'
import { StepPaymentMethods } from '@/components/onboarding/steps/StepPaymentMethods'
import { StepSavingsGoal } from '@/components/onboarding/steps/StepSavingsGoal'
import { StepDebts } from '@/components/onboarding/steps/StepDebts'
import { StepBudgetStyle } from '@/components/onboarding/steps/StepBudgetStyle'
import { StepReview } from '@/components/onboarding/steps/StepReview'

const STEP_COMPONENTS: Record<StepId, ComponentType<OnboardingStepProps>> = {
  welcome: StepWelcome,
  location: StepLocation,
  income: StepIncome,
  'fixed-costs': StepFixedCosts,
  subscriptions: StepSubscriptions,
  'payment-methods': StepPaymentMethods,
  'savings-goal': StepSavingsGoal,
  debts: StepDebts,
  'budget-style': StepBudgetStyle,
  review: StepReview,
}

export default function OnboardingPage() {
  const router = useRouter()
  const {
    currentStep,
    currentIndex,
    totalSteps,
    progress,
    isFirst,
    isLast,
    next,
    back,
    draft,
    updateDraft,
    goTo,
  } = useOnboardingStepper()

  const StepBody = STEP_COMPONENTS[currentStep.id]

  const handleComplete = useCallback(() => {
    applyOnboardingStepperDraft(draft)
    try {
      localStorage.setItem(ONBOARDING_COMPLETE_KEY, JSON.stringify(draft))
      localStorage.removeItem('buddget-onboarding-draft')
    } catch {
      /* ignore */
    }
    router.push('/budget-preview')
  }, [draft, router])

  const onContinue = () => {
    if (isLast) {
      handleComplete()
      return
    }
    next()
  }

  return (
    <div className="flex flex-col min-h-screen text-white">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">
          Bud<span className="text-[#E50914]">d</span>get
        </span>
        <span className="text-sm text-[#5A5A72]">
          {currentIndex + 1} of {totalSteps}
        </span>
      </div>

      <div className="h-0.5 bg-[#2A2A38]">
        <div
          className="h-full bg-[#E50914] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col px-6 py-8 max-w-lg mx-auto w-full min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0 overflow-y-auto"
          >
            <h1 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h1>
            <p className="text-[#A0A0B8] mb-8">{currentStep.subtitle}</p>
            <StepBody draft={draft} updateDraft={updateDraft} goTo={goTo} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-6 py-4 border-t border-[#2A2A38] flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          className={cn(
            'px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
            isFirst ?
              'invisible'
            : 'text-[#A0A0B8] hover:text-white hover:bg-[#1A1A24]',
          )}
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-[#E50914] hover:bg-[#F40612] text-white"
        >
          {isLast ? 'Build my budget →' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
