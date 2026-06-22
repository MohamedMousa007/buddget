import type { User } from '@supabase/supabase-js'
import { isNative } from '@/lib/native/isNative'

/**
 * Single source of truth for "has this user finished onboarding?".
 *
 * `user_metadata.onboarding_completed` is the ONLY signal: it lives in the auth
 * JWT, is available synchronously after `getSession()` on every cold start, is
 * per-user (never inherited across users on a shared device), is cross-device,
 * and survives the native hard reload. The previous local-store bridge
 * (`profile.onboardingVersion`) was device-global localStorage AND a synced
 * field, so a new signup on a device that previously had an onboarded user
 * inherited it and skipped onboarding — that whole class of bug is gone.
 *
 * Set authoritatively by `/api/auth/complete-journey` (service role) and mirrored
 * into the local session by `supabase.auth.updateUser()` in `completeOnboarding`.
 */
export function onboardingComplete(user: User | null): boolean {
  return user?.user_metadata?.onboarding_completed === true
}

/** After sign-in / sign-up, send users who haven't finished onboarding there first. */
export function routeAfterAuth(user: User | null, preferredNext: string): string {
  if (!user) return preferredNext
  return onboardingComplete(user) ? preferredNext : '/onboarding'
}

/**
 * Navigate to a top-level route after an auth/onboarding transition.
 *
 * Native (Capacitor) ships a Next static export with NO server: `router.replace`
 * + `router.refresh` can leave `usePathname()` desynced from the rendered route,
 * so the root-layout AppShell computes the wrong bare/chrome state and the user
 * lands on the dashboard with no header/tabs. A hard `location.assign` loads the
 * destination's static HTML fresh — layout, page, and pathname stay consistent,
 * and the session is restored from localStorage on reload. Web keeps the smooth
 * client-side replace.
 */
export function navigateAfterAuth(
  router: { replace: (href: string) => void },
  target: string,
): void {
  if (isNative()) {
    const href = target.endsWith('/') || target.includes('?') ? target : `${target}/`
    window.location.assign(href)
    return
  }
  router.replace(target)
}
