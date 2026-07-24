import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { requireSupabaseSecretKey, requireSupabaseUrl } from '@/lib/supabase/env'

/** Server-only Supabase client (bypasses RLS). Never import from client components. */
export function createServiceRoleClient() {
  return createClient<Database>(requireSupabaseUrl(), requireSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/** Alias for API keys v2 naming (`SUPABASE_SECRET_KEY`). */
export const createSecretClient = createServiceRoleClient

/**
 * The service-role client, carrying the database schema.
 *
 * Use this instead of a bare `SupabaseClient` anywhere the client is passed around: without the
 * schema generic, table names, column types AND rpc() function names are all unchecked, so a
 * typo'd RPC compiles cleanly and fails only at runtime.
 */
export type ServiceClient = ReturnType<typeof createServiceRoleClient>
