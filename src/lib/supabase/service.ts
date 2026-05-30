import { createClient } from '@supabase/supabase-js'
import { requireSupabaseSecretKey, requireSupabaseUrl } from '@/lib/supabase/env'

/** Server-only Supabase client (bypasses RLS). Never import from client components. */
export function createServiceRoleClient() {
  return createClient(requireSupabaseUrl(), requireSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** Alias for API keys v2 naming (`SUPABASE_SECRET_KEY`). */
export const createSecretClient = createServiceRoleClient
