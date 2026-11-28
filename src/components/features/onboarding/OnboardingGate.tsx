'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { navigate } from '@/lib/navigation/navigate'
import { useNavPath } from '@/lib/navigation/navStore'
import { useOnboardingState } from './useOnboardingState'

/** Accounts already offered the journey in this session; leaving or finishing never brings it back on its own. */
const offered = new Set<string>()

/** Sends a new account (or one mid-journey) to `/start` once, from whichever app screen it is on. */
export function OnboardingGate() {
  const { user } = useAuth()
  const path = useNavPath()
  const { state, ready } = useOnboardingState()

  useEffect(() => {
    if (!user || !ready || state === 'hidden' || offered.has(user.id)) return
    offered.add(user.id)
    // Already there: it still counts as offered, so leaving the journey does not bring it back.
    if (path !== '/start') navigate('/start', { replace: true })
  }, [user, ready, state, path])

  return null
}
