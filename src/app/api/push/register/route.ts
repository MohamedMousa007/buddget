/**
 * POST /api/push/register
 *
 * Saves a device's FCM/APNS push token to `public.push_tokens`. Used by the
 * Capacitor iOS + Android shells right after a successful login. Idempotent:
 * a re-registration of the same `(user, token)` upserts.
 *
 * Auth: bearer Supabase JWT (mobile) OR signed-in cookie session (web).
 */
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { isRevokedDevice, upsertSelf } from '@/lib/server/devices/registry'

const bodySchema = z.object({
  token: z.string().min(10).max(2048),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().max(50).optional().nullable(),
  locale: z.string().max(20).optional().nullable(),
  deviceModel: z.string().max(200).optional().nullable(),
  deviceId: z.string().max(100).optional().nullable(),
  notify: z.boolean().optional(),
})

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { token, platform, appVersion, locale, deviceModel, deviceId, notify } = parsed.data

  try {
    const service = createServiceRoleClient()
    // The phone is registered before its token is, so a push never meets a phone it cannot place. A removed phone gets none.
    // A body without a deviceId must not skip that: the header names the phone too.
    const headerDeviceId = request.headers.get(DEVICE_ID_HEADER)
    if (!deviceId && (await isRevokedDevice(service, userId, headerDeviceId))) {
      return NextResponse.json({ error: 'This phone was removed from the account', revoked: true }, { status: 403 })
    }
    if (deviceId) {
      const self = await upsertSelf(service, userId, deviceId, { platform, model: deviceModel ?? null, appVersion: appVersion ?? null, pushPermission: 'granted' })
      if (self.revoked) return NextResponse.json({ error: 'This phone was removed from the account', revoked: true }, { status: 403 })
      if (notify !== undefined) await service.from('user_devices').update({ notify }).eq('user_id', userId).eq('device_id', deviceId)
    }
    // Claim this device token for the current user. A token belongs to exactly
    // one account at a time (push_tokens has a UNIQUE(token)); removing any prior
    // owner's row first prevents the unique-violation that blocked account
    // switches AND stops the previous account from receiving this device's pushes.
    await service.from('push_tokens').delete().eq('token', token).neq('user_id', userId)
    const { error } = await service
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          app_version: appVersion ?? null,
          locale: locale ?? null,
          device_model: deviceModel ?? null,
          device_id: deviceId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      )

    // A rotated token replaces the phone's old one, so one phone never hears a push twice.
    if (!error && deviceId) await service.from('push_tokens').delete().eq('user_id', userId).eq('device_id', deviceId).neq('token', token)

    if (error) {
      console.error('[push/register] upsert failed', error)
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/register] unexpected', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveActiveApiUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tok = (json as { token?: string } | null)?.token?.trim()
  const deviceId = request.headers.get('x-buddget-device-id')?.trim().slice(0, 100)
  if (!tok && !deviceId) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const service = createServiceRoleClient()
  if (tok) await service.from('push_tokens').delete().match({ user_id: userId, token: tok })
  if (deviceId) await service.from('push_tokens').delete().match({ user_id: userId, device_id: deviceId })
  return NextResponse.json({ ok: true })
}
