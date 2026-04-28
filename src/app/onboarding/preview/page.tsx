import { redirect } from 'next/navigation'
import { onboardingPreviewPath } from '@/lib/onboarding/onboardingRoutes'

/** Legacy URL: `/onboarding/preview` → `/budget-preview`. */
export default function LegacyOnboardingPreviewRedirect() {
  redirect(onboardingPreviewPath())
}
