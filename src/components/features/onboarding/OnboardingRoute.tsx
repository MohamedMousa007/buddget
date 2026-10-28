'use client'

import { useEffect } from 'react'
import { navigate } from '@/lib/navigation/navigate'
import { OnboardingJourney } from './OnboardingJourney'
import { useOnboarding } from './useOnboarding'
import { useOnboardingState } from './useOnboardingState'

/** `/start`: the journey for a new account, or for one that left it and chose to continue. Anyone else goes to Flow. */
export function OnboardingRoute() {
  const { state, ready } = useOnboardingState()
  const { record } = useOnboarding()
  // Leaving sets skippedAt, which hides the automatic offer; the Flow card still reopens a started, unfinished journey.
  const open = state !== 'hidden' || (!!record && !record.doneAt)

  useEffect(() => {
    if (ready && !open) navigate('/flow', { replace: true })
  }, [ready, open])

  return open ? <OnboardingJourney /> : null
}
