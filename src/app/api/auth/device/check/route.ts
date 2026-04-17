import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { readDeviceCookie, setDeviceCookie } from '@/lib/auth/deviceCookie'

/**
 * Decides whether the current browser needs to complete the email-OTP second
 * factor for this user. Returns `{ trusted: true }` when:
 *  - the user has 2FA off, OR
 *  - the user has 2FA on AND the `buddget_device_id` cookie matches a row in
 *    `trusted_devices` for this user.
 *
 * Also ensures the cookie exists (we mint one on first visit) and refreshes
 * `last_used_at` on trusted hits.
 *
 * Called by the client after a successful `signInWithPassword` to gate whether
 * the sign-in continues or is redirected through the OTP step.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let deviceId = await readDeviceCookie()
    if (!deviceId) {
      deviceId = randomUUID()
      await setDeviceCookie(deviceId)
    }

    const admin = createServiceRoleClient()
    const { data: settings, error: sErr } = await admin
      .from('user_settings')
      .select('two_factor_email_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
    if (sErr) {
      console.error('[auth/device/check] read settings failed', sErr.message)
      // Fail closed: if we can't tell, ask for OTP. Safer than silently granting.
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
      // Best-effort bump of last_used_at; don't block on failure.
      admin
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
