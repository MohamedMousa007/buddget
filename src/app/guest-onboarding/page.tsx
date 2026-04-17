'use client'

import { GuestOnboardingView } from '@/components/features/onboarding/GuestOnboardingView'

/**
 * Dedicated route for guest-mode onboarding. AuthProvider routes guests here
 * when they haven't completed their 6-step flow; once complete, the guest is
 * redirected to `/` with the save-progress banner visible.
 */
export default function GuestOnboardingPage() {
  return <GuestOnboardingView />
}
