import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
import { isNative } from '@/lib/native/isNative'

/**
 * Browser / Capacitor Supabase client.
 * Native uses localStorage (cookie storage breaks across origins in the WebView).
 */
export function createClient() {
  const url = requireSupabaseUrl()
  const key = requireSupabasePublishableKey()

  if (isNative()) {
    return createSupabaseClient(url, key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  }

  return createBrowserClient(url, key)
}
