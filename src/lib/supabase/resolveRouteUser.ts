import { createClient as createJwtClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { requireSupabasePublishableKey, requireSupabaseUrl } from '@/lib/supabase/env'
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
      if (error) {
        console.warn('[auth] Bearer token validation failed', error.message)
        return { user: null, error: `token_invalid: ${error.message}` }
      }
    } catch (e) {
      console.warn('[auth] Bearer token verification exception', e)
      return { user: null, error: 'token_validation_failed' }
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

export interface AuthMethodRef {
  method: string
  timestamp: number
}

export interface RouteIdentity {
  id: string
  email: string | null
  /** How the session was established (JWT `amr`): lets a route ask for a recent one-time-code login. */
  amr: AuthMethodRef[]
}

/** Three base64url parts: a JWT. Opaque tokens (SMS ingest tokens) are not, and must never cost an Auth round trip. */
export function looksLikeJwt(token: string): boolean {
  return /^[\w-]+\.[\w-]+\.[\w-]*$/.test(token)
}

// One verifier for the process: supabase-js keeps the JWKS cached on the client, so verification is local after the first call.
let verifier: SupabaseClient | null = null
function jwtVerifier(): SupabaseClient {
  verifier ??= createJwtClient(requireSupabaseUrl(), requireSupabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  return verifier
}

function identityOf(claims: { sub?: string; role?: string; email?: string; amr?: unknown[] } | null | undefined): RouteIdentity | null {
  return claims?.sub && claims.role === 'authenticated' ? { id: claims.sub, email: claims.email ?? null, amr: (claims.amr ?? []).filter((a): a is AuthMethodRef => typeof a === 'object' && a !== null) } : null
}

/**
 * Who is calling, without asking the Auth server: the JWT's signature and expiry are checked locally against the
 * project's published signing key. Use it wherever only the id (and email) matter. Sensitive or admin-mutating
 * paths keep `resolveRouteUser`, which asks the Auth server and so also notices a revoked session at once.
 */
export async function resolveRouteIdentity(request: Request): Promise<RouteIdentity | null> {
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (bearer) {
    if (!looksLikeJwt(bearer)) return null
    try {
      const { data } = await jwtVerifier().auth.getClaims(bearer)
      const id = identityOf(data?.claims)
      if (id) return id
    } catch {
      /* fall through to the session cookie */
    }
  }
  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase.auth.getClaims()
    return identityOf(data?.claims)
  } catch {
    return null
  }
}
