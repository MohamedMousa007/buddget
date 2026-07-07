import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'

/**
 * Biometric sign-in for a signed-out user. The device already proved the user's
 * identity locally (OS biometric prompt) and sends its stored secret. We verify
 * the secret against the stored hash for this device, then mint a FRESH session
 * via `generateLink` — returning a one-time OTP the client redeems with
 * `verifyOtp`. Nothing is replayed, so refresh-token reuse can never fire.
 *
 * ponytail: no rate-limit here yet — the secret is 256-bit and device-bound, so
 * guessing is infeasible; add throttling if abuse ever shows up in logs.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { secret?: string } | null
    const secret = body?.secret?.trim()
    if (!secret) return NextResponse.json({ error: 'Missing secret' }, { status: 400 })

    const deviceId = await resolveDeviceId(request)
    const admin = createServiceRoleClient()

    const { data: row, error: rErr } = await admin
      .from('biometric_devices')
      .select('user_id, secret_hash')
      .eq('device_id', deviceId)
      .maybeSingle()
    if (rErr) {
      console.error('[biometric/signin] read failed', rErr.message)
      return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
    }
    if (!row) return NextResponse.json({ error: 'No biometric account on this device' }, { status: 404 })

    // Constant-time compare of the SHA-256 hashes.
    const provided = createHash('sha256').update(secret).digest()
    const stored = Buffer.from(row.secret_hash, 'hex')
    if (stored.length !== provided.length || !timingSafeEqual(stored, provided)) {
      return NextResponse.json({ error: 'Biometric verification failed' }, { status: 401 })
    }

    const { data: userData, error: uErr } = await admin.auth.admin.getUserById(row.user_id)
    const email = userData?.user?.email
    if (uErr || !email) {
      return NextResponse.json({ error: 'Account no longer available' }, { status: 404 })
    }

    const { data: link, error: lErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const token = link?.properties?.email_otp
    if (lErr || !token) {
      console.error('[biometric/signin] generateLink failed', lErr?.message)
      return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
    }

    void admin
      .from('biometric_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .then(({ error }) => {
        if (error) console.error('[biometric/signin] bump last_used_at failed', error.message)
      })

    // Client redeems this OTP with verifyOtp({ email, token, type: 'email' }).
    return NextResponse.json({ email, token })
  } catch (e) {
    console.error('[biometric/signin] exception', e)
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
  }
}
