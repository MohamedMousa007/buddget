import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** Resolve the caller's user id from a Bearer JWT (native) or session cookie (web). */
export async function resolveApiUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (bearer) {
    try {
      const service = createServiceRoleClient()
      const { data, error } = await service.auth.getUser(bearer)
      if (!error && data.user) return data.user.id
    } catch {
      /* fallthrough to cookie */
    }
  }
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}
