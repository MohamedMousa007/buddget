import { createBrowserClient } from '@supabase/ssr'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'

export function createClient() {
  return createBrowserClient(requireSupabaseUrl(), requireSupabasePublishableKey())
}
