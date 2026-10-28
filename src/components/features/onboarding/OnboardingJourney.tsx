'use client'

import { useCallback, useEffect, useRef } from 'react'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { isNative } from '@/lib/native/isNative'
import { STEPS, visibleSteps, type StepKey } from '@/lib/onboarding/steps'
import { trackOnboarding } from '@/lib/onboarding/track'
import { StepAbout } from './StepAbout'
import { StepAccounts } from './StepAccounts'
import { StepAutomate } from './StepAutomate'
import { StepBudget } from './StepBudget'
import { StepGoals } from './StepGoals'
import { StepIncome } from './StepIncome'
import type { StepChrome } from './chrome'
import { useOnboarding } from './useOnboarding'

const VIEWS: Record<StepKey, (p: { chrome: StepChrome }) => React.ReactElement> = {
  about: StepAbout,
  goals: StepGoals,
  accounts: StepAccounts,
  income: StepIncome,
  automate: StepAutomate,
  budget: StepBudget,
}

/** Six short steps (five on the web). Progress is saved at every move, so leaving and coming back loses nothing. */
export function OnboardingJourney() {
  const { record, begin, goTo, leave } = useOnboarding()
  const steps = visibleSteps(isNative())

  useEffect(() => begin(), [begin])

  // The record may point at a step this platform skips (started in the app, continued on the web).
  const stored = STEPS[Math.min(record?.step ?? 0, STEPS.length - 1)]
  const key = steps.includes(stored) ? stored : (steps.find((s) => STEPS.indexOf(s) > STEPS.indexOf(stored)) ?? steps[steps.length - 1])
  const index = steps.indexOf(key)

  const seen = useRef<StepKey | null>(null)
  useEffect(() => {
    if (seen.current === key) return
    seen.current = key
    trackOnboarding('onboarding_step_view', { step: key })
  }, [key])

  const next = useCallback(() => {
    trackOnboarding('onboarding_step_complete', { step: key })
    const to = steps[index + 1]
    if (to) goTo(STEPS.indexOf(to))
  }, [goTo, index, key, steps])

  const goBack = useCallback(() => goTo(STEPS.indexOf(steps[index - 1])), [goTo, index, steps])

  useEffect(
    () =>
      registerBackGuard(() => {
        if (index > 0) goBack()
        else leave()
        return true
      }),
    [index, goBack, leave],
  )

  const View = VIEWS[key]
  return <View chrome={{ index, total: steps.length, onBack: index > 0 ? goBack : undefined, onSkip: leave, next }} />
}
