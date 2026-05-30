import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseCookieToSet } from '@/lib/supabase/cookieTypes'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(requireSupabaseUrl(), requireSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
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
