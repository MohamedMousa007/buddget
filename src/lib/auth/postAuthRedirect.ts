import { isNative } from '@/lib/native/isNative'

/** A same-site path or '/'. Browsers read `\` as `/` and drop tabs and newlines, so `/\\evil.com` and `/\t/evil.com` leave the site. */
export function safeInternalPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) return '/'
  return path
}

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
  rawTarget: string,
): void {
  const target = safeInternalPath(rawTarget)
  if (isNative()) {
    const href = target.endsWith('/') || target.includes('?') ? target : `${target}/`
    window.location.assign(href)
    return
  }
  router.replace(target)
}
