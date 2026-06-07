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
  if (!base) return path
  if (!path.startsWith('/')) return `${base}/${path}`
  return `${base}${path}`
}

/** True when the static bundle should call the deployed API origin. */
export function usesRemoteApi(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL?.trim())
}

/**
 * Origin used for OAuth / password-reset redirects. In the Capacitor WebView the
 * page origin is `https://localhost`, so callbacks must target the deployed site.
 */
export function appOrigin(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
  if (apiBase) return apiBase
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (appUrl && !appUrl.includes('localhost')) return appUrl
  if (typeof window !== 'undefined') return window.location.origin
  return appUrl ?? ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedSupabaseClient: any = null

/**
 * Builds Authorization (+ native device id) headers for cross-origin API calls.
 * No-op on web — cookies carry the session on same-origin requests.
 * Caches the Supabase client to avoid leaking autoRefreshToken timers on native.
 */
export async function buildAuthHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init)
  if (!usesRemoteApi()) return headers

  const { createClient } = await import('@/lib/supabase/client')
  const client = cachedSupabaseClient || (cachedSupabaseClient = createClient())
  const {
    data: { session },
  } = await client.auth.getSession()
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
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
  return fetch(apiUrl(input), { ...init, headers })
}

/** Convenience wrapper around `fetch` that prepends the API base when present. */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init)
}
