import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'

/** Resolve the caller's user id from a Bearer JWT (native) or session cookie (web), verified locally. */
export async function resolveApiUserId(req: Request): Promise<string | null> {
  return (await resolveRouteIdentity(req))?.id ?? null
}
