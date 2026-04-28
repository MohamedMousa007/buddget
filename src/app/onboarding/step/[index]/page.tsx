'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ONBOARDING_BASE } from '@/lib/onboarding/onboardingRoutes'

/** Legacy multi-page steps → single `/onboarding` stepper. */
export default function OnboardingLegacyStepRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace(ONBOARDING_BASE)
  }, [router])
  return null
}
