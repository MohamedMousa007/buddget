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

/**
 * Returns true when the JWT access token is expired (or unparseable).
 * Uses a 30-second buffer so we refresh slightly before actual expiry.
 */
function isJwtExpired(token: string): boolean {
  try {
    let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4) // pad base64url for atob
    const payload = JSON.parse(atob(b64))
    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() + 30_000
  } catch {
    return true
  }
}

/**
 * Builds Authorization (+ native device id) headers for cross-origin API calls.
 * No-op on web — cookies carry the session on same-origin requests.
 *
 * On native the app can be backgrounded/killed, stopping the autoRefreshToken
 * timer. On next foreground getSession() can return an expired token from
 * localStorage → server 401. We detect expiry and force a refreshSession()
 * before every cross-origin call so the token is always valid.
 */
export async function buildAuthHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init)
  if (!usesRemoteApi()) return headers

  const { createClient } = await import('@/lib/supabase/client')
  const client = createClient()
  let {
    data: { session },
  } = await client.auth.getSession()

  // Proactively refresh when the stored token is missing or about to expire.
  // On native the auto-refresh timer can be paused while the app is backgrounded,
  // so by record time the stored token may be stale. refreshSession() can fail if
  // the refresh token was already rotated — fall back to a re-read of the session
  // (the background timer may have refreshed it) rather than dropping the header.
  if (!session?.access_token || isJwtExpired(session.access_token)) {
    const { data, error } = await client.auth.refreshSession()
    if (!error && data.session) {
      session = data.session
    } else {
      const reread = await client.auth.getSession()
      session = reread.data.session
    }
  }

  // Attach whatever token we ended up with. The server is the authority on
  // validity (clock skew / local decode quirks shouldn't drop the header), and
  // apiFetchAuth retries once with a forced refresh if the server says 401.
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

/**
 * Authenticated fetch — Bearer JWT on Capacitor, cookies on web.
 * Retries once on 401 after forcing a token refresh: this is the definitive
 * guard against a stale native token (the WebView pauses auto-refresh while
 * backgrounded). FormData/JSON bodies are reusable across the retry.
 */
export async function apiFetchAuth(input: string, init?: RequestInit): Promise<Response> {
  const headers = await buildAuthHeaders(init?.headers)
  const res = await fetch(apiUrl(input), { ...init, headers })
  if (res.status !== 401 || !usesRemoteApi()) return res

  // Force a fresh token and retry exactly once.
  try {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.refreshSession()
  } catch {
    /* fall through — retry will reflect whatever session we have */
  }
  const retryHeaders = await buildAuthHeaders(init?.headers)
  if (!retryHeaders.has('Authorization')) return res // no token to retry with
  return fetch(apiUrl(input), { ...init, headers: retryHeaders })
}

/** Convenience wrapper around `fetch` that prepends the API base when present. */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init)
}
