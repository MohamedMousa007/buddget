/**
 * POST /api/push/register
 *
 * Saves a device's FCM/APNS push token to `public.push_tokens`. Used by the
 * Capacitor iOS + Android shells right after a successful login. Idempotent:
 * a re-registration of the same `(user, token)` upserts.
 *
 * Auth: bearer Supabase JWT (mobile) OR signed-in cookie session (web).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  token: z.string().min(10).max(2048),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().max(50).optional().nullable(),
  locale: z.string().max(20).optional().nullable(),
  deviceModel: z.string().max(200).optional().nullable(),
})

async function resolveUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (bearer) {
    try {
      const service = createServiceRoleClient()
      const { data, error } = await service.auth.getUser(bearer)
      if (!error && data.user) return data.user.id
    } catch {
      /* fallthrough */
    }
  }
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request)
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

  const { token, platform, appVersion, locale, deviceModel } = parsed.data

  try {
    const service = createServiceRoleClient()
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
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      )

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
  const userId = await resolveUserId(request)
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
  if (!tok) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const service = createServiceRoleClient()
  await service.from('push_tokens').delete().match({ user_id: userId, token: tok })
  return NextResponse.json({ ok: true })
}
