import { isAccountActive } from '@/lib/auth/accountActive'
import { resolveRouteIdentity, type RouteIdentity } from '@/lib/supabase/resolveRouteUser'

/** Resolve the caller's user id from a Bearer JWT (native) or session cookie (web), verified locally. */
export async function resolveApiUserId(req: Request): Promise<string | null> {
  return (await resolveRouteIdentity(req))?.id ?? null
}

/** `resolveRouteIdentity` that also refuses a suspended or deleted account (see `isAccountActive`). For the paid AI routes. */
export async function resolveActiveApiIdentity(req: Request): Promise<RouteIdentity | null> {
  const identity = await resolveRouteIdentity(req)
  return identity && (await isAccountActive(identity.id)) ? identity : null
}

/** `resolveApiUserId` that also refuses a suspended or deleted account within a minute (see `isAccountActive`). For the SMS and push routes. */
export async function resolveActiveApiUserId(req: Request): Promise<string | null> {
  const id = await resolveApiUserId(req)
  return id && (await isAccountActive(id)) ? id : null
}
