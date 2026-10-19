import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import type { SupabaseCookieToSet } from '@/lib/supabase/cookieTypes'
import { parseCookiesPreferLast, supabaseCookieDomain } from '@/lib/supabase/cookieDomain'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'

export async function createClient() {
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const domain = supabaseCookieDomain(requestHeaders.get('host'))

  return createServerClient(requireSupabaseUrl(), requireSupabasePublishableKey(), {
    cookieOptions: domain ? { domain } : undefined,
    cookies: {
      getAll() {
        return domain ? parseCookiesPreferLast(requestHeaders.get('cookie')) : cookieStore.getAll()
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component without mutable cookies
        }
      },
    },
  })
}
