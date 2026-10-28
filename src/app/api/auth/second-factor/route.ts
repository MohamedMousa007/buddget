import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { signedInWithin } from '@/lib/auth/recentSignIn'
import { resolveVerifiedIdentity } from '@/lib/supabase/resolveRouteUser'
import { INBOX_PROOF_METHODS, INBOX_PROOF_WINDOW_SECONDS, recordSecondFactor } from '@/lib/server/secondFactor'

/**
 * Marks the calling session as having passed the second factor. The session itself must prove it: its JWT has to record
 * a one-time-code sign-in from the last ten minutes (email 2-step, or the code the biometric sign-in redeems), so a
 * password-only session cannot mark itself.
 */
export async function POST(request: Request) {
  try {
    const identity = await resolveVerifiedIdentity(request)
    if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (!signedInWithin(identity.amr, INBOX_PROOF_METHODS, INBOX_PROOF_WINDOW_SECONDS)) {
      return NextResponse.json({ error: 'Verification required' }, { status: 403 })
    }
    const body = (await request.json().catch(() => null)) as { method?: string } | null
    const recorded = await recordSecondFactor(createServiceRoleClient(), identity, body?.method === 'biometric' ? 'biometric' : 'otp')
    return NextResponse.json({ ok: true, recorded })
  } catch (e) {
    console.error('[auth/second-factor] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
