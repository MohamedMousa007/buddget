/**
 * Origins the native SMS bridge may send a bank SMS and its ingest token to. The Kotlin (SmsApiUrl) and Swift (SmsApiUrl)
 * validators enforce the same rule; this is the JS twin so a bad base never reaches the plugin. Mirrors the hosts in
 * capacitor.config.ts `allowNavigation`. http://localhost is only for development builds.
 */
const HOST = 'buddget.app'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export function isAllowedSmsApiUrl(raw: string | null | undefined, development = process.env.NODE_ENV !== 'production'): boolean {
  if (!raw?.trim()) return false
  let url: URL
  try { url = new URL(raw.trim()) } catch { return false }
  if (url.username || url.password || url.search || url.hash) return false
  if (url.pathname !== '/') return false
  const host = url.hostname.toLowerCase()
  if (url.protocol === 'https:') return (url.port === '' || url.port === '443') && (host === HOST || host.endsWith(`.${HOST}`))
  if (url.protocol === 'http:') return development && LOCAL_HOSTS.has(host)
  return false
}
