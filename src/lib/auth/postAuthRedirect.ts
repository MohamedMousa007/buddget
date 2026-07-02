import { isNative } from '@/lib/native/isNative'

/**
 * Navigate to a top-level route after a successful auth action.
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
