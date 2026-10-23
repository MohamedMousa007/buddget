import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { createServiceRoleClient } from '@/lib/supabase/service'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({ notifyOnSms: z.boolean().nullable().optional(), name: z.string().trim().min(1).max(40).optional() })

async function owner(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return { res: outdated }
  const userId = await resolveApiUserId(request)
  if (!userId) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { userId }
}

/** Another of the user's phones: whether it should be told about captured bank texts, or its name. */
export async function PATCH(request: Request, { params }: Params) {
  const o = await owner(request)
  if ('res' in o) return o.res
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const patch = {
    ...(parsed.data.notifyOnSms !== undefined ? { notify_on_sms: parsed.data.notifyOnSms } : {}),
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const { data } = await createServiceRoleClient().from('user_devices').update(patch).eq('user_id', o.userId).eq('device_id', (await params).id).is('revoked_at', null).select('device_id').maybeSingle()
  return data ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

/**
 * Removes a phone: it stops collecting and being notified at once, and signs itself out the next time it opens.
 * The phone you are holding cannot be removed here; sign out on it instead.
 */
export async function DELETE(request: Request, { params }: Params) {
  const o = await owner(request)
  if ('res' in o) return o.res
  const id = (await params).id
  if (request.headers.get(DEVICE_ID_HEADER)?.trim() === id) return NextResponse.json({ error: 'Sign out on this phone instead' }, { status: 400 })
  const service = createServiceRoleClient()
  const { data } = await service.from('user_devices').update({ revoked_at: new Date().toISOString(), collects_sms: false }).eq('user_id', o.userId).eq('device_id', id).is('revoked_at', null).select('device_id').maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await Promise.all([
    service.from('sms_ingest_tokens').update({ is_active: false }).eq('user_id', o.userId).eq('device_id', id),
    service.from('push_tokens').delete().eq('user_id', o.userId).eq('device_id', id),
  ])
  return NextResponse.json({ ok: true })
}
