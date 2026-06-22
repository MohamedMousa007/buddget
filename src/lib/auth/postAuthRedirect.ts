import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/lib/store/types'
import { isNative } from '@/lib/native/isNative'

/** Local store slice used by the onboarding gate. */
export interface OnboardingStoreSignal {
  profile: Pick<UserProfile, 'onboardingVersion'>
}

/**
 * Single source of truth for "has this user finished onboarding?".
 *
 * Two signals, two roles:
 *
 * 1. `user_metadata.onboarding_completed` — server-authoritative, cross-device.
 *    Set by the `/api/auth/complete-journey` service-role route. Survives app
 *    restarts and device changes once the Supabase session refreshes.
 *
 * 2. `profile.onboardingVersion >= 2` — local bridge signal. Written to
 *    localStorage by `completeOnboarding()` *before* any API call or navigation,
 *    so it survives the native hard reload while the first post-reload sync pull
 *    is still in flight. The API also persists `onboarding_version = 2` to the
 *    DB, so after the pull completes both signals agree.
 *
 * NOTE: `isExpertOnboardingComplete` was previously a third arm here. It was
 * removed because it measures a different thing (detailed survey completion, not
 * core onboarding) and caused the gate to silently pass users who hadn't
 * actually finished the signup flow.
 */
export function onboardingComplete(user: User | null, store: OnboardingStoreSignal): boolean {
  // Primary: server-set flag in user metadata (authoritative, cross-device)
  if (user?.user_metadata?.onboarding_completed === true) return true
  // Bridge: local marker holds the gate open while the first sync pull is in
  // flight after a hard reload on native. Converges with the server once pull()
  // reads back onboarding_version = 2 (set by complete-journey API).
  return (store.profile.onboardingVersion ?? 0) >= 2
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
