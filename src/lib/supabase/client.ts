import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
import { isNative } from '@/lib/native/isNative'

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
        },
      })
    }
    return _nativeClient
  }

  return createBrowserClient(url, key)
}
