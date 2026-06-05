import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'

/**
 * Mark the current device as trusted for the authenticated user.
 * Called after successful email-OTP verification (signup or 2FA).
 */
export async function POST(req: Request) {
  try {
    const { user } = await resolveRouteUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const deviceId = await resolveDeviceId(req)
    const ua = (req.headers.get('user-agent') || '').slice(0, 500)

    const admin = createServiceRoleClient()
    const { error } = await admin.from('trusted_devices').upsert(
      {
        user_id: user.id,
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
