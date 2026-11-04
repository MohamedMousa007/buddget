import { noteSecondFactorResponse } from '@/lib/auth/secondFactorGate'
import { appHostFor, appHostForRedirects, configuredAdminHost, normalizeHost } from '@/lib/admin/host'

/**
 * Resolves the absolute origin used by client-side `fetch` calls.
 *
 * - Web (Vercel / local): returns `''` so requests stay relative
 *   (`/api/foo`) and ride the same origin as the page.
 * - Capacitor (iOS / Android): returns `NEXT_PUBLIC_API_BASE_URL`
 *   (e.g. `https://buddget.app`) so the WebView fetches the deployed API
 *   instead of the bundled `capacitor://localhost` origin.
 *
 * Always wrap `fetch('/api/...')` with `apiUrl()` for routes that exist
 * server-side. Pure browser endpoints (third-party CDNs already absolute) do
 * not need this helper.
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  if (!base || onDeployedWebHost()) return path
  if (!path.startsWith('/')) return `${base}/${path}`
  return `${base}${path}`
}

/** True when the static bundle should call the deployed API origin. */
export function usesRemoteApi(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) && !onDeployedWebHost()
}

/**
 * The admin portal's own web host serves its API itself, with cookies. Sending its calls to the app's origin
 * would be cross-origin, so they stay relative there even when a remote API base is configured for native.
 */
export function onAdminHost(): boolean {
  return typeof window !== 'undefined' && normalizeHost(window.location.hostname) === configuredAdminHost()
}

/**
 * The deployed web app (product, marketing or admin host) serves its own API with cookies. A remote API base left in its
 * build env would make every call cross-origin, which CORS and the CSP refuse: "Failed to fetch".
 */
export function onDeployedWebHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = normalizeHost(window.location.hostname)
  const apex = appHostFor(configuredAdminHost())
  return host === apex || host.endsWith(`.${apex}`) || host === appHostForRedirects()
}

/**
 * Origin used for OAuth / password-reset redirects. In the Capacitor WebView the
 * page origin is `https://localhost`, so callbacks must target the deployed site.
 */
export function appOrigin(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (appUrl && !appUrl.includes('localhost')) return appUrl
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
  if (apiBase) return apiBase
  if (typeof window !== 'undefined') return window.location.origin
  return appUrl ?? ''
}

/**
 * Builds Authorization (+ native device id) headers for cross-origin API calls.
 * No-op on web — cookies carry the session on same-origin requests.
 *
 * Token freshness is owned entirely by supabase-js: getSession() returns the
 * current token and refreshes it under an internal lock when needed. We must NOT
 * call refreshSession() ourselves — doing so races the SDK's auto-refresh and
 * rotates the refresh token out from under it, which fails the grant (400) and
 * kills the session. App foreground re-arms the SDK timer via startAutoRefresh
 * in AuthProvider.
 */
export async function buildAuthHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init)
  if (!usesRemoteApi()) return headers

  if (!headers.has('Authorization')) {
    const { createClient } = await import('@/lib/supabase/client')
    const { data: { session } } = await createClient().auth.getSession()
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  }

  const { isNative } = await import('@/lib/native/isNative')
  if (isNative()) {
    const { getOrCreateDeviceId } = await import('@/lib/native/deviceId')
    const { DEVICE_ID_HEADER } = await import('@/lib/auth/deviceIdConstants')
    const deviceId = await getOrCreateDeviceId()
    if (deviceId) headers.set(DEVICE_ID_HEADER, deviceId)
  }

  return headers
}

/** Authenticated fetch — Bearer JWT on Capacitor, cookies on web. */
export async function apiFetchAuth(input: string, init?: RequestInit): Promise<Response> {
  const headers = await buildAuthHeaders(init?.headers)
  return noteSecondFactorResponse(await fetch(apiUrl(input), { ...init, headers }))
}

/** Convenience wrapper around `fetch` that prepends the API base when present. */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init)
}
