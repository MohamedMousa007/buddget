import { createBrowserClient, serializeCookieHeader, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient, processLock } from '@supabase/supabase-js'
import { authCookieOptions, hostOnlyExpiryOptions, parseCookiesPreferLast, supabaseCookieDomain } from '@/lib/supabase/cookieDomain'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
import { secondFactorAwareFetch } from '@/lib/auth/secondFactorGate'
import { isNative } from '@/lib/native/isNative'
import '@/lib/clientInfo'

// Singleton native client — one instance shared across AuthProvider, apiBase,
// and any other caller. Multiple instances each have their own in-memory
// session cache and refresh timers, which can race: one instance reads a
// stale/expired token from localStorage before another instance finishes
// refreshing it. A singleton eliminates that race entirely.
let _nativeClient: ReturnType<typeof createSupabaseClient> | null = null

/**
 * Browser / Capacitor Supabase client.
 * Native uses a module-level singleton backed by localStorage.
 * Web uses createBrowserClient (cookie-based SSR auth).
 */
export function createClient() {
  const url = requireSupabaseUrl()
  const key = requireSupabasePublishableKey()

  if (isNative()) {
    if (!_nativeClient) {
      _nativeClient = createSupabaseClient(url, key, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          // One WebView, one client: an in-process lock cannot be stolen the way navigator.locks is ("Lock broken by another request").
          lock: processLock,
        },
        global: { fetch: secondFactorAwareFetch },
      })
    }
    return _nativeClient
  }

  const domain = typeof window === 'undefined' ? undefined : supabaseCookieDomain(window.location.hostname)
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  if (!domain) return createBrowserClient(url, key, { cookieOptions: authCookieOptions(undefined, secure), global: { fetch: secondFactorAwareFetch } })

  // Shared across buddget.app and admin.buddget.app. Every write also expires the old host-only twin so it cannot
  // shadow the fresh cookie, and reads take the newest copy if both exist (see cookieDomain.ts).
  return createBrowserClient(url, key, {
    cookieOptions: authCookieOptions(domain, secure),
    global: { fetch: secondFactorAwareFetch },
    cookies: {
      getAll: () => parseCookiesPreferLast(document.cookie),
      setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => {
        cookies.forEach(({ name, value, options }) => {
          document.cookie = serializeCookieHeader(name, value, options)
          document.cookie = serializeCookieHeader(name, '', hostOnlyExpiryOptions)
        })
      },
    },
  })
}
