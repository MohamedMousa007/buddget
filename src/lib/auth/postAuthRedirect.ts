import type { User } from '@supabase/supabase-js'
import type { OnboardingState, UserProfile } from '@/lib/store/types'
import { isExpertOnboardingComplete } from '@/lib/onboarding/onboardingProgress'
import { isNative } from '@/lib/native/isNative'

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

/**
 * Navigate to a top-level route after an auth/onboarding transition.
 *
 * Native (Capacitor) ships a Next static export with NO server: `router.replace`
 * + `router.refresh` can leave `usePathname()` desynced from the rendered route,
 * so the root-layout AppShell computes the wrong bare/chrome state and the user
 * lands on the dashboard with no header/tabs. A hard `location.assign` loads the
 * destination's static HTML fresh — layout, page, and pathname stay consistent,
 * and the session is restored from localStorage on reload (same pattern as
 * AccountDeletedScreen). Web keeps the smooth client-side replace.
 */
export function navigateAfterAuth(
  router: { replace: (href: string) => void },
  target: string,
): void {
  if (isNative()) {
    // Static export serves `route/index.html`; add the trailing slash so the
    // Capacitor local server resolves the file (skip when a query is present).
    const href = target.endsWith('/') || target.includes('?') ? target : `${target}/`
    window.location.assign(href)
    return
  }
  router.replace(target)
}
