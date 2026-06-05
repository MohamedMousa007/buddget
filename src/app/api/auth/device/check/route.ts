import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'

/**
 * Decides whether the current browser needs to complete the email-OTP second
 * factor for this user. Returns `{ trusted: true }` when:
 *  - the user has 2FA off, OR
 *  - the user has 2FA on AND the device id matches a row in `trusted_devices`.
 *
 * Native apps send `X-Buddget-Device-Id`; web uses the HttpOnly cookie.
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
      .select('device_id')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle()
    if (tErr) {
      console.error('[auth/device/check] read trusted_devices failed', tErr.message)
      return NextResponse.json({ trusted: false, deviceId, required: true })
    }

    if (match) {
      void admin
        .from('trusted_devices')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .then(({ error }) => {
          if (error) console.error('[auth/device/check] bump last_used_at failed', error.message)
        })
      return NextResponse.json({ trusted: true, deviceId, required: false })
    }

    return NextResponse.json({ trusted: false, deviceId, required: true })
  } catch (e) {
    console.error('[auth/device/check] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
