import type { AuthMethodRef } from '@/lib/supabase/resolveRouteUser'

/** True when the session was established by `methods` no more than `maxAgeSeconds` ago. */
export function signedInWithin(amr: AuthMethodRef[], methods: string[], maxAgeSeconds: number, nowMs = Date.now()): boolean {
  return amr.some((a) => methods.includes(a.method) && nowMs / 1000 - a.timestamp <= maxAgeSeconds)
}
