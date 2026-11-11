import { NextResponse } from 'next/server'
import { signedInWithin } from '@/lib/auth/recentSignIn'
import { isRateLimited } from '@/lib/server/rateLimit'
import { resolveVerifiedIdentity } from '@/lib/supabase/resolveRouteUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { deleteUserCompletely } from '@/lib/server/deleteAccount'

/**
 * Permanently delete the authenticated user's account and every piece of data Buddget holds for them.
 *
 * Supports both cookie-based auth (web) and Bearer JWT (native Capacitor) via
 * resolveVerifiedIdentity — never pass a user id in the body. The session must have been established in the last
 * five minutes (the client re-authenticates and retries on `reauth_required`).
 */
const REAUTH_WINDOW_SECONDS = 300
const DELETES_PER_HOUR = 3

export async function POST(request: Request) {
  try {
    const identity = await resolveVerifiedIdentity(request)
    if (!identity) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!signedInWithin(identity.amr, ['password', 'otp', 'oauth', 'id_token', 'totp'], REAUTH_WINDOW_SECONDS)) {
      return NextResponse.json({ error: 'Sign in again to delete your account', code: 'reauth_required' }, { status: 403 })
    }

    const service = createServiceRoleClient()
    if (await isRateLimited(service, `account-delete:${identity.id}`, 3600, DELETES_PER_HOUR)) {
      return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
    }

    const result = await deleteUserCompletely(service, identity.id, { keepStaffAccess: true })
    if (!result.ok) {
      console.error('[account/delete] failed:', result.error, result.details)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    if (result.partialErrors.length > 0) {
      console.error('[account/delete] partial failures:', result.partialErrors)
      // 207: the account is gone and the app may move on, but this is not a clean success and must not read as one.
      return NextResponse.json({ ok: false, deleted: true, partial: true, partialCount: result.partialErrors.length }, { status: 207 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[account/delete] unexpected failure', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
