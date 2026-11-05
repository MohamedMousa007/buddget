import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { resolveRouteIdentity, resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { signedInWithin } from '@/lib/auth/recentSignIn'
import { verifyReauth } from '@/lib/server/reauth'

const REAUTH_WINDOW_SECONDS = 300
const SECRET_HASH_PATTERN = /^[0-9a-f]{64}$/

/**
 * Bind this device to the signed-in account for biometric sign-in. Stores only a
 * SHA-256 hash of the device secret (the plaintext stays on-device behind the OS
 * biometric prompt). One row per device, tied to a single account at a time: a
 * device already bound to another account is refused (409) until that account
 * disables biometric, so a guessed device id cannot take over someone's binding.
 * A binding lets the device mint sessions for the account without password or 2-step, so creating one needs proof of
 * the owner: a sign-in from the last five minutes, or the current password (typed `reauth_required` otherwise).
 */
export async function POST(request: Request) {
  try {
    const [identity, { user }] = await Promise.all([resolveRouteIdentity(request), resolveRouteUser(request)])
    if (!user || !identity || identity.id !== user.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as { secret_hash?: string; currentPassword?: string } | null
    const secretHash = body?.secret_hash?.trim().toLowerCase()
    if (!secretHash || !SECRET_HASH_PATTERN.test(secretHash)) {
      return NextResponse.json({ error: 'Invalid secret_hash' }, { status: 400 })
    }

    const admin = createServiceRoleClient()
    const currentPassword = typeof body?.currentPassword === 'string' && body.currentPassword ? body.currentPassword.slice(0, 256) : undefined
    if (currentPassword || !signedInWithin(identity.amr, ['password', 'otp', 'oauth', 'id_token', 'totp'], REAUTH_WINDOW_SECONDS)) {
      const verdict = await verifyReauth(admin, identity, user, currentPassword)
      if (verdict === 'rate_limited') return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
      if (verdict === 'wrong_password') return NextResponse.json({ error: 'Wrong password', code: 'wrong_password' }, { status: 403 })
      if (verdict === 'reauth_required') return NextResponse.json({ error: 'Confirm it is you first', code: 'reauth_required' }, { status: 403 })
    }

    const deviceId = await resolveDeviceId(request)
    const now = new Date().toISOString()
    // Claim a free device, else refresh the secret only when this account already owns it.
    const claim = await admin
      .from('biometric_devices')
      .upsert({ device_id: deviceId, user_id: user.id, secret_hash: secretHash, created_at: now, last_used_at: null }, { onConflict: 'device_id', ignoreDuplicates: true })
      .select('device_id')
    if (claim.error) {
      console.error('[biometric/register] claim failed', claim.error.message)
      return NextResponse.json({ error: 'Register failed' }, { status: 500 })
    }
    if (!claim.data?.length) {
      const own = await admin
        .from('biometric_devices')
        .update({ secret_hash: secretHash, last_used_at: null })
        .eq('device_id', deviceId)
        .eq('user_id', user.id)
        .select('device_id')
      if (own.error) {
        console.error('[biometric/register] update failed', own.error.message)
        return NextResponse.json({ error: 'Register failed' }, { status: 500 })
      }
      if (!own.data?.length) return NextResponse.json({ error: 'This device is linked to another account' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[biometric/register] exception', e)
    return NextResponse.json({ error: 'Register failed' }, { status: 500 })
  }
}

/** Disable biometric for this account on this device. */
export async function DELETE(request: Request) {
  try {
    const { user } = await resolveRouteUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const deviceId = await resolveDeviceId(request)
    const admin = createServiceRoleClient()
    const { error } = await admin
      .from('biometric_devices')
      .delete()
      .eq('device_id', deviceId)
      .eq('user_id', user.id)
    if (error) {
      console.error('[biometric/register] delete failed', error.message)
      return NextResponse.json({ error: 'Unregister failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[biometric/register] delete exception', e)
    return NextResponse.json({ error: 'Unregister failed' }, { status: 500 })
  }
}
