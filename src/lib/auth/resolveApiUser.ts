import { isAccountActive } from '@/lib/auth/accountActive'
import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'

/** Resolve the caller's user id from a Bearer JWT (native) or session cookie (web), verified locally. */
export async function resolveApiUserId(req: Request): Promise<string | null> {
  return (await resolveRouteIdentity(req))?.id ?? null
}

/** `resolveApiUserId` that also refuses a suspended or deleted account within a minute (see `isAccountActive`). For the SMS and push routes. */
export async function resolveActiveApiUserId(req: Request): Promise<string | null> {
  const id = await resolveApiUserId(req)
  return id && (await isAccountActive(id)) ? id : null
}
