'use client'

import { CoreOnboardingView } from '@/components/features/onboarding/CoreOnboardingView'
import { LegacyOnboardingPage } from '@/components/features/onboarding/LegacyOnboardingPage'

/**
 * Flip `NEXT_PUBLIC_PROGRESSIVE_ONBOARDING=1` in env to serve the 4-step core
 * gate instead of the legacy 27-step expert survey. Old flow stays as the
 * fallback for now (rollback = flip the flag off + redeploy).
 */
const PROGRESSIVE_ENABLED = process.env.NEXT_PUBLIC_PROGRESSIVE_ONBOARDING === '1'

export default function OnboardingPage() {
  return PROGRESSIVE_ENABLED ? <CoreOnboardingView /> : <LegacyOnboardingPage />
}
