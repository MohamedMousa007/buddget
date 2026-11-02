import { NextResponse } from 'next/server'
import { freshHook, parseCrashEvent, validSignature } from '@/lib/integrations/sentryWebhook'
import { createServiceRoleClient } from '@/lib/supabase/service'

// Native crash events carry every thread and the loaded-image list, well past 200 KB; Vercel's own cap is 4.5 MB.
const MAX_BODY = 4_000_000

/** Sentry tells us an issue fired; the crash lands in client_crashes for the admin portal. */
export async function POST(request: Request) {
  const secret = process.env.SENTRY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const raw = await request.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large' }, { status: 413 })
  if (!validSignature(raw, request.headers.get('sentry-hook-signature'), secret)) return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  if (!freshHook(request.headers.get('sentry-hook-timestamp'), Date.now())) return NextResponse.json({ error: 'Stale' }, { status: 400 })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const crash = parseCrashEvent(body)
  if (!crash) return NextResponse.json({ ok: true })

  const service = createServiceRoleClient()
  const args = {
    p_fingerprint: crash.fingerprint,
    p_release: crash.release,
    p_title: crash.title,
    p_level: crash.level,
    p_culprit: crash.culprit,
    p_stack: crash.stack,
    p_platform: crash.platform,
    p_build: crash.build,
    p_device_id: crash.deviceId,
    p_user_id: crash.userId,
    p_sentry_issue_id: crash.issueId,
    p_sentry_url: crash.url,
    p_seen: crash.seen,
  }
  // The generated argument types are non-null; these functions accept null for the optional ones.
  let { error } = await service.rpc('record_client_crash_v2', { ...args, p_event_id: crash.eventId } as never)
  // Until migration 0223 is applied, v2 does not exist: fall back to the original function.
  if (error?.code === 'PGRST202') ({ error } = await service.rpc('record_client_crash', args as never))
  if (error) return NextResponse.json({ error: 'Could not record' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
