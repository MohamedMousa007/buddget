import type { User } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Resolve the signed-in user from a route handler request.
 * Native apps send `Authorization: Bearer <jwt>`; web uses cookies.
 */
export async function resolveRouteUser(
  request: Request,
): Promise<{ user: User | null; error?: string }> {
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (bearer) {
    try {
      const admin = createServiceRoleClient()
      const { data, error } = await admin.auth.getUser(bearer)
      if (!error && data.user) return { user: data.user }
    } catch {
      /* fall through to cookies */
    }
  }
  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return { user: null, error: error?.message }
    return { user: data.user }
  } catch (e) {
    return { user: null, error: e instanceof Error ? e.message : 'auth_failed' }
  }
}
