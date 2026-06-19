import { Capacitor } from '@capacitor/core'

/** True only inside the Capacitor WebView (iOS / Android). False on web/PWA. */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * True when this is the Capacitor static-export bundle (set at build time by
 * `scripts/capacitor-build.mjs`). Independent of the runtime Capacitor bridge,
 * so OAuth can hard-route to native sign-in even if `isNativePlatform()` ever
 * mis-reports — the web-redirect flow is unrecoverable inside the WebView.
 */
export function isNativeShellBuild(): boolean {
  return process.env.NEXT_PUBLIC_NATIVE_SHELL === 'true'
}

/** `'ios' | 'android' | 'web'` — safe to call during SSR (returns `'web'`). */
export function getPlatform(): 'ios' | 'android' | 'web' {
  try {
    const p = Capacitor.getPlatform()
    if (p === 'ios' || p === 'android') return p
    return 'web'
  } catch {
    return 'web'
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android'
}

export function isIOS(): boolean {
  return getPlatform() === 'ios'
}

/** True when running in the dedicated PWA shell (standalone display-mode). */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  return Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  )
}
