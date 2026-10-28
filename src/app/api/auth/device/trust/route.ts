import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { signedInWithin } from '@/lib/auth/recentSignIn'
import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'

/**
 * Mark the current device as trusted for the authenticated user.
 * Called after successful email-OTP verification (signup or 2FA). The session itself must prove it: its JWT
 * has to record a one-time-code sign-in from the last ten minutes, so a password-only session cannot self-trust.
 */
const OTP_METHODS = ['otp', 'email/signup', 'magiclink']
const OTP_PROOF_WINDOW_SECONDS = 600

export async function POST(req: Request) {
  try {
    const identity = await resolveRouteIdentity(req)
    if (!identity) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!signedInWithin(identity.amr, OTP_METHODS, OTP_PROOF_WINDOW_SECONDS)) {
      return NextResponse.json({ error: 'Verification required' }, { status: 403 })
    }

    const deviceId = await resolveDeviceId(req)
    const ua = (req.headers.get('user-agent') || '').slice(0, 500)

    const admin = createServiceRoleClient()
    const { error } = await admin.from('trusted_devices').upsert(
      {
        user_id: identity.id,
        device_id: deviceId,
        user_agent: ua || null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    )
    if (error) {
      console.error('[auth/device/trust] upsert failed', error.message)
      return NextResponse.json({ error: 'Trust failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deviceId })
  } catch (e) {
    console.error('[auth/device/trust] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
