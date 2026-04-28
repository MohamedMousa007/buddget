'use client'

import { useEffect, useState } from 'react'
import { EMPTY_DRAFT, type OnboardingDraft } from '@/lib/onboarding/onboardingDraft'
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps'

const DRAFT_KEY = 'buddget-onboarding-draft'

function coerceDraft(raw: unknown): OnboardingDraft {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_DRAFT }
  const r = raw as Partial<OnboardingDraft>
  return {
    ...EMPTY_DRAFT,
    ...r,
    incomeSources: Array.isArray(r.incomeSources) ? r.incomeSources : EMPTY_DRAFT.incomeSources,
    fixedCosts: Array.isArray(r.fixedCosts) ? r.fixedCosts : EMPTY_DRAFT.fixedCosts,
    subscriptions: Array.isArray(r.subscriptions) ? r.subscriptions : EMPTY_DRAFT.subscriptions,
    paymentMethods: Array.isArray(r.paymentMethods) ? r.paymentMethods : EMPTY_DRAFT.paymentMethods,
    debts: Array.isArray(r.debts) ? r.debts : EMPTY_DRAFT.debts,
  }
}

/**
 * Step index (0-based) and onboarding draft with localStorage persistence for the draft only.
 */
export function useOnboardingStepper() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    if (typeof window === 'undefined') return { ...EMPTY_DRAFT }
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) return coerceDraft(JSON.parse(saved))
    } catch {
      /* ignore */
    }
    return { ...EMPTY_DRAFT }
  })

  const currentStep = ONBOARDING_STEPS[currentIndex]!
  const totalSteps = ONBOARDING_STEPS.length
  const progress = (currentIndex / (totalSteps - 1)) * 100
  const isFirst = currentIndex === 0
  const isLast = currentIndex === totalSteps - 1

  const next = () => {
    if (!isLast) setCurrentIndex((i) => i + 1)
  }
  const back = () => {
    if (!isFirst) setCurrentIndex((i) => i - 1)
  }
  const goTo = (index: number) => {
    const max = ONBOARDING_STEPS.length - 1
    setCurrentIndex(Math.max(0, Math.min(max, index)))
  }
  const updateDraft = (updates: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* ignore quota / private mode */
    }
  }, [draft])

  return {
    currentStep,
    currentIndex,
    totalSteps,
    progress,
    isFirst,
    isLast,
    next,
    back,
    goTo,
    draft,
    updateDraft,
  }
}
