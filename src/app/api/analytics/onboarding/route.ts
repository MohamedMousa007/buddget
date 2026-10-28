import { NextResponse } from 'next/server'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { ONBOARDING_EVENTS, sanitizeMeta, type OnboardingEvent } from '@/lib/onboarding/events'
import { createServiceRoleClient } from '@/lib/supabase/service'

const HOURLY_CAP = 120
const MAX_META_CHARS = 400

/** Records a first-run funnel event for the signed-in user. Only known event names, small payloads, capped per hour. */
export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { type?: unknown; meta?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const type = typeof body.type === 'string' ? body.type : ''
  if (!(ONBOARDING_EVENTS as readonly string[]).includes(type)) return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
  const raw = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? (body.meta as Record<string, unknown>) : {}
  if (JSON.stringify(raw).length > MAX_META_CHARS) return NextResponse.json({ error: 'Too large' }, { status: 413 })
  const meta = sanitizeMeta(type as OnboardingEvent, raw)
  if (!meta) return NextResponse.json({ error: 'Invalid event' }, { status: 400 })

  const service = createServiceRoleClient()
  const { data: allowed } = await service.rpc('api_rate_hit', { p_key: `onb-event:${uid}`, p_window_seconds: 3600, p_max_hits: HOURLY_CAP })
  if (allowed === false) return NextResponse.json({ ok: true, dropped: true })
  await service.from('app_analytics_events').insert({ user_id: uid, event_type: type, metadata: meta as never })
  return NextResponse.json({ ok: true })
}
