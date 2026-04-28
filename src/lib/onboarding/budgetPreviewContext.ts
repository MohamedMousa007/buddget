import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { calculateMonthlyIncome } from '@/lib/utils/calculations'
import { buildAiPlanContext } from '@/lib/onboarding/buildAiPlanContext'
import { buildPlanAnswersFromStore } from '@/lib/onboarding/onboardingPlanAnswers'
import type { JourneyPlanContext } from '@/lib/onboarding/buildAiPlanContext'

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    p.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

/** Full AI plan context from live store (for preview + regenerate). */
export function buildBudgetPreviewContext(extraUserFeedback?: string): JourneyPlanContext {
  const state = useFinanceStore.getState()
  const monthlyIncome = calculateMonthlyIncome(
    state.incomeSources,
    state.settings.baseCurrency,
    state.exchangeRates,
  )
  const answersRaw =
    state.onboardingState.answers && typeof state.onboardingState.answers === 'object'
      ? (state.onboardingState.answers as Record<string, unknown>)
      : {}
  const personaRaw = answersRaw.onboarding_persona
  const onboardingPersona =
    personaRaw === 'balanced' || personaRaw === 'aggressive_saver' || personaRaw === 'just_tracking' ?
      personaRaw
    : undefined

  return buildAiPlanContext({
    answers: buildPlanAnswersFromStore(state),
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
    extraUserFeedback,
    onboardingPersona,
    surveyExtras: answersRaw,
  })
}
