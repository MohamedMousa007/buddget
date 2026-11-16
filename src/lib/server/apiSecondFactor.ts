import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { identityOf, looksLikeJwt, verifyBearerJwt, type RouteIdentity } from '@/lib/supabase/resolveRouteUser'

/** Routes a not-yet-verified session must still reach: the second-factor step itself, anonymous and machine-called routes, the portal (own guard). */
const EXEMPT_PREFIXES = ['/api/auth/', '/api/cron/', '/api/webhooks/', '/api/health', '/api/site/', '/api/app-config', '/api/flags', '/api/gold', '/api/rates', '/api/prices', '/api/admin/']
const VERIFIED_TTL_MS = 60_000
const CACHE_MAX = 2000
const verified = new Map<string, number>()

export function needsSecondFactor(pathname: string): boolean {
  return pathname.startsWith('/api/') && !EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
}

async function callerOf(request: NextRequest, cookieClaims: Parameters<typeof identityOf>[0]): Promise<RouteIdentity | null> {
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (bearer) return looksLikeJwt(bearer) ? verifyBearerJwt(bearer) : null // opaque SMS ingest tokens are not sessions
  return identityOf(cookieClaims)
}

/**
 * The server half of the second-factor gate (the PostgREST half is migration 0208): a password-only session of a 2-step
 * user is refused on every /api route with the same answer the app already turns into the code screen. Anonymous calls and
 * infrastructure errors pass (the database gate and each route's own auth remain), so this can never lock the API.
 */
export async function apiSecondFactorRefusal(
  request: NextRequest,
  pathname: string,
  cookieClaims: Parameters<typeof identityOf>[0],
  admin: SupabaseClient = createServiceRoleClient() as unknown as SupabaseClient,
  now = Date.now(),
): Promise<NextResponse | null> {
  if (!needsSecondFactor(pathname)) return null
  const who = await callerOf(request, cookieClaims)
  if (!who?.sessionId) return null
  if ((verified.get(who.sessionId) ?? 0) > now) return null
  try {
    const { data, error } = await admin.rpc('second_factor_verified', { p_user: who.id, p_session: who.sessionId, p_amr: who.amr })
    if (error) {
      console.error('[api-2fa] check failed', error.message)
      return null
    }
    if (data !== false) {
      if (verified.size >= CACHE_MAX) verified.clear()
      verified.set(who.sessionId, now + VERIFIED_TTL_MS)
      return null
    }
  } catch (e) {
    console.error('[api-2fa] check threw', e)
    return null
  }
  return NextResponse.json(
    { error: 'second_factor_required', message: 'Verify your second factor to continue.' },
    { status: 403, headers: { 'X-Second-Factor-Required': 'true', 'Cache-Control': 'no-store' } },
  )
}
