import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveRouteIdentity } from '@/lib/supabase/resolveRouteUser'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { DEVICE_ID_PATTERN } from '@/lib/auth/resolveDeviceId'
import { upsertSelf } from '@/lib/server/devices/registry'
import { createServiceRoleClient } from '@/lib/supabase/service'

const selfSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  model: z.string().max(200).nullish(),
  appVersion: z.string().max(50).nullish(),
  collects: z.boolean().optional(),
  collectsSms: z.boolean().optional(),
  pushPermission: z.enum(['granted', 'denied']).nullish(),
  smsQueue: z.object({ pending: z.number().int().min(0).max(100_000), oldestAt: z.string().max(40).nullable(), lastResult: z.string().max(60).nullable(), evicted: z.number().int().min(0).max(1_000_000).optional() }).optional(),
})

async function caller(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return { res: outdated }
  const identity = await resolveRouteIdentity(request)
  if (!identity) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const deviceId = request.headers.get(DEVICE_ID_HEADER)?.trim().slice(0, 100) || null
  return { userId: identity.id, deviceId, sessionId: identity.sessionId }
}

/** The account's devices: who is main, who is told about things, and when each last captured a bank text. */
export async function GET(request: Request) {
  const c = await caller(request)
  if ('res' in c) return c.res
  const service = createServiceRoleClient()
  const { data: rows } = await service.from('user_devices').select('*').eq('user_id', c.userId).is('revoked_at', null).order('last_seen_at', { ascending: false })
  return NextResponse.json({
    thisDeviceId: c.deviceId,
    devices: (rows ?? []).map((d) => ({
      deviceId: d.device_id, name: d.name ?? d.model ?? d.platform, platform: d.platform, appVersion: d.app_version, lastSeenAt: d.last_seen_at,
      collectsSms: d.collects_sms, isMain: d.is_main, notify: d.notify, pushPermission: d.push_permission, lastSmsAt: d.collects_sms ? d.last_sms_at : null,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

async function report(request: Request) {
  const c = await caller(request)
  if ('res' in c) return { res: c.res }
  if (!c.deviceId || !DEVICE_ID_PATTERN.test(c.deviceId)) return { res: NextResponse.json({ error: 'Missing device id' }, { status: 400 }) }
  const parsed = selfSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return { res: NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const { pushPermission, ...self } = parsed.data
  const result = await upsertSelf(createServiceRoleClient(), c.userId, c.deviceId, { ...self, sessionId: c.sessionId, ...(pushPermission !== undefined ? { pushPermission } : {}) })
  return { result }
}

/** Heartbeat: this phone says hello (on open, and every few hours). `revoked` tells a removed phone to sign out. */
export async function POST(request: Request) {
  const r = await report(request)
  if ('res' in r) return r.res
  if (r.result.revoked) return NextResponse.json({ revoked: true })
  const d = r.result.device
  return NextResponse.json({ revoked: false, collectsSms: d?.collects_sms ?? false })
}

/** This phone sets its own SMS role. */
export async function PATCH(request: Request) {
  const r = await report(request)
  if ('res' in r) return r.res
  if (r.result.revoked) return NextResponse.json({ revoked: true })
  return NextResponse.json({ revoked: false, collectsSms: r.result.device?.collects_sms ?? false })
}
