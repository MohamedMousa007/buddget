import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { resolveRouteUser } from '@/lib/supabase/resolveRouteUser'

/**
 * Bind this device to the signed-in account for biometric sign-in. Stores only a
 * SHA-256 hash of the device secret (the plaintext stays on-device behind the OS
 * biometric prompt). One row per device: enabling biometric for a new account
 * overwrites any previous binding on the same device (takeover), so a device is
 * only ever tied to a single account at a time.
 */
export async function POST(request: Request) {
  try {
    const { user } = await resolveRouteUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as { secret_hash?: string } | null
    const secretHash = body?.secret_hash?.trim()
    if (!secretHash || secretHash.length < 32) {
      return NextResponse.json({ error: 'Invalid secret_hash' }, { status: 400 })
    }

    const deviceId = await resolveDeviceId(request)
    const admin = createServiceRoleClient()
    // Upsert on the device_id PK → replaces any binding to another account.
    const { error } = await admin
      .from('biometric_devices')
      .upsert(
        { device_id: deviceId, user_id: user.id, secret_hash: secretHash, created_at: new Date().toISOString(), last_used_at: null },
        { onConflict: 'device_id' },
      )
    if (error) {
      console.error('[biometric/register] upsert failed', error.message)
      return NextResponse.json({ error: 'Register failed' }, { status: 500 })
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
