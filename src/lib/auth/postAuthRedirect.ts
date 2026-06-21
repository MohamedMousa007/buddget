import type { User } from '@supabase/supabase-js'
import type { OnboardingState, UserProfile } from '@/lib/store/types'
import { isExpertOnboardingComplete } from '@/lib/onboarding/onboardingProgress'

/** Local store slice that proves onboarding finished on this device. */
export interface OnboardingStoreSignal {
  profile: Pick<UserProfile, 'onboardingVersion'>
  onboardingState: OnboardingState | undefined
}

/**
 * Source of truth for "has this user finished onboarding?".
 *
 * Trusting `user_metadata.onboarding_completed` alone is unsafe on native: the
 * Capacitor singleton client often loses the `updateUser` metadata write to a
 * token-refresh race, so the in-memory user never gets the flag. The onboarding
 * flow ALSO writes `profile.onboardingVersion = 2` to the persisted store before
 * navigating, which is race-free on native. Either signal means done.
 */
export function onboardingComplete(user: User | null, store: OnboardingStoreSignal): boolean {
  return (
    user?.user_metadata?.onboarding_completed === true ||
    (store.profile.onboardingVersion ?? 0) >= 2 ||
    isExpertOnboardingComplete(store.onboardingState)
  )
}

/** After sign-in / sign-up, send users who haven't finished onboarding there first. */
export function routeAfterAuth(
  user: User | null,
  preferredNext: string,
  store: OnboardingStoreSignal,
): string {
  if (!user) return preferredNext
  if (onboardingComplete(user, store)) return preferredNext
  return '/onboarding'
}
