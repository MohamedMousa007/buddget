import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { resolveRouteIdentity, resolveRouteUser } from '@/lib/supabase/resolveRouteUser'
import { recordSecondFactor } from '@/lib/server/secondFactor'
import { deliverDeviceSecret, newDeviceSecret, readDeviceSecret, secretMatches } from '@/lib/server/trustedDevice'

/**
 * Decides whether the current browser needs to complete the email-OTP second
 * factor for this user. Returns `{ trusted: true }` when:
 *  - the user has 2FA off, OR
 *  - the user has 2FA on AND the device id matches a row in `trusted_devices` AND, once that row has a secret hash, the
 *    caller presents the secret it was issued (a hash compare). The id alone is sent on every request and never suffices.
 *
 * A legacy row (no hash yet) is accepted by id once and upgraded: a secret is issued in the response so the real device
 * keeps its trust without an email code, and from then on the id alone is refused.
 *
 * Native apps send `X-Buddget-Device-Id` and `X-Buddget-Device-Secret`; web uses the HttpOnly cookies.
 */
export async function POST(request: Request) {
  try {
    const { user } = await resolveRouteUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const deviceId = await resolveDeviceId(request)

    const admin = createServiceRoleClient()
    const { data: settings, error: sErr } = await admin
      .from('user_settings')
      .select('two_factor_email_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
    if (sErr) {
      console.error('[auth/device/check] read settings failed', sErr.message)
      return NextResponse.json({ trusted: false, deviceId, required: true })
    }

    const twoFaOn = Boolean(settings?.two_factor_email_enabled)
    if (!twoFaOn) {
      return NextResponse.json({ trusted: true, deviceId, required: false })
    }

    const { data: match, error: tErr } = await admin
      .from('trusted_devices')
      .select('device_id, secret_hash')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle()
    if (tErr) {
      console.error('[auth/device/check] read trusted_devices failed', tErr.message)
      return NextResponse.json({ trusted: false, deviceId, required: true })
    }

    if (match) {
      let issued: { deviceSecret?: string } = {}
      if (match.secret_hash) {
        if (!secretMatches(await readDeviceSecret(request), match.secret_hash)) {
          return NextResponse.json({ trusted: false, deviceId, required: true })
        }
      } else {
        // Legacy row: only the caller whose update lands (secret_hash still null) is upgraded and trusted.
        const { secret, hash } = newDeviceSecret()
        const upgraded = await admin
          .from('trusted_devices')
          .update({ secret_hash: hash })
          .eq('user_id', user.id)
          .eq('device_id', deviceId)
          .is('secret_hash', null)
          .select('device_id')
        if (upgraded.error || !upgraded.data?.length) return NextResponse.json({ trusted: false, deviceId, required: true })
        issued = await deliverDeviceSecret(request, secret)
      }
      const identity = await resolveRouteIdentity(request)
      if (identity) await recordSecondFactor(admin, identity, 'trusted_device')
      void admin
        .from('trusted_devices')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .then(({ error }) => {
          if (error) console.error('[auth/device/check] bump last_used_at failed', error.message)
        })
      return NextResponse.json({ trusted: true, deviceId, required: false, ...issued })
    }

    return NextResponse.json({ trusted: false, deviceId, required: true })
  } catch (e) {
    console.error('[auth/device/check] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
