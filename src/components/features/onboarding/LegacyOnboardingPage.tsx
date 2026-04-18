'use client'

import { useOnboardingPage } from '@/hooks/useOnboardingPage'
import { OnboardingPageView } from '@/components/features/onboarding/OnboardingPageView'

/**
 * Thin wrapper so `useOnboardingPage()` (with its side effects) only mounts
 * when the legacy survey is actually rendered. The progressive core-gate path
 * skips it entirely.
 */
export function LegacyOnboardingPage() {
  const ctx = useOnboardingPage()
  return <OnboardingPageView {...ctx} />
}
