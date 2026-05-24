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

/** Convenience wrapper around `fetch` that prepends the API base when present. */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init)
}
