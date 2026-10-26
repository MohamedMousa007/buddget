import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { promoteMain } from '@/lib/server/devices/registry'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({ notify: z.boolean().nullable().optional(), makeMain: z.literal(true).optional(), name: z.string().trim().min(1).max(40).optional() })

async function owner(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return { res: outdated }
  const userId = await resolveApiUserId(request)
  if (!userId) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { userId }
}

/** One of the user's phones: whether it is told about things, whether it is the main phone, or its name. */
export async function PATCH(request: Request, { params }: Params) {
  const o = await owner(request)
  if ('res' in o) return o.res
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const id = (await params).id
  const service = createServiceRoleClient()
  const patch = {
    ...(parsed.data.notify !== undefined ? { notify: parsed.data.notify } : {}),
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
  }
  if (Object.keys(patch).length === 0 && !parsed.data.makeMain) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const { data: device } = await service.from('user_devices').select('device_id, push_permission').eq('user_id', o.userId).eq('device_id', id).is('revoked_at', null).maybeSingle()
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (parsed.data.makeMain) {
    if (device.push_permission === 'denied') return NextResponse.json({ error: 'Notifications are blocked on that phone' }, { status: 409 })
    await service.from('user_devices').update({ is_main: false }).eq('user_id', o.userId).eq('is_main', true).neq('device_id', id)
    await service.from('user_devices').update({ is_main: true, ...patch }).eq('user_id', o.userId).eq('device_id', id)
    return NextResponse.json({ ok: true })
  }
  await service.from('user_devices').update(patch).eq('user_id', o.userId).eq('device_id', id)
  return NextResponse.json({ ok: true })
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
  const { data: before } = await service.from('user_devices').select('is_main').eq('user_id', o.userId).eq('device_id', id).is('revoked_at', null).maybeSingle()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await service.from('user_devices').update({ revoked_at: new Date().toISOString(), collects_sms: false, is_main: false }).eq('user_id', o.userId).eq('device_id', id)
  await Promise.all([
    service.from('sms_ingest_tokens').update({ is_active: false }).eq('user_id', o.userId).eq('device_id', id),
    service.from('push_tokens').delete().eq('user_id', o.userId).eq('device_id', id),
  ])
  // The main phone is the one that hears everything; losing it must not leave the account silent without telling anyone.
  if (before.is_main) await promoteMain(service, o.userId, id, 'removed')
  return NextResponse.json({ ok: true })
}
