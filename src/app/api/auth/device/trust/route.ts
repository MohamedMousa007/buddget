import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { readDeviceCookie, setDeviceCookie } from '@/lib/auth/deviceCookie'

/**
 * Mark the current browser as a trusted device for the authenticated user.
 * Called after a successful email-OTP verification (both the post-signup
 * verification and the post-sign-in 2FA challenge).
 *
 * Mints a device_id cookie if one isn't set, then upserts the row so the user
 * skips the OTP step on subsequent sign-ins from the same browser.
 */
export async function POST(req: Request) {
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

    const ua = (req.headers.get('user-agent') || '').slice(0, 500)

    const admin = createServiceRoleClient()
    const { error } = await admin.from('trusted_devices').upsert(
      {
        user_id: user.id,
        device_id: deviceId,
        user_agent: ua || null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' }
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
