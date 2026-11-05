/**
 * GET /api/cron/ios-crashes  (Vercel Cron)
 *
 * Imports the crash logs TestFlight testers share (App Store Connect API) into client_crashes. Apple's report is the
 * only source for crashes that kill the app before Sentry can start, such as a launch-time UIKit runtime issue.
 * Replays are safe: the submission id is the event id, so one crash never counts twice.
 *
 * Needs ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY (the .p8) and ASC_APP_ID. Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { ascCredentialsFromEnv, fetchIosCrashes } from '@/lib/integrations/appStoreConnect'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60
const LOOKBACK_MS = 3 * 24 * 3600_000

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const creds = ascCredentialsFromEnv()
  if (!creds) return NextResponse.json({ error: 'App Store Connect is not configured' }, { status: 503 })

  let crashes
  try {
    crashes = await fetchIosCrashes(creds, new Date(Date.now() - LOOKBACK_MS))
  } catch (e) {
    console.error('[cron/ios-crashes] fetch failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not read App Store Connect' }, { status: 502 })
  }

  const service = createServiceRoleClient()
  let recorded = 0
  for (const c of crashes) {
    const userId = c.email ? ((await service.rpc('user_id_by_email', { p_email: c.email })).data ?? null) : null
    const { error } = await service.rpc('record_client_crash_v2', {
      p_fingerprint: c.fingerprint,
      p_release: c.release,
      p_title: c.title,
      p_level: 'fatal',
      p_culprit: c.culprit,
      p_stack: c.stack,
      p_platform: 'ios',
      p_build: c.build,
      p_device_id: null,
      p_user_id: userId,
      p_sentry_issue_id: null,
      p_sentry_url: null,
      p_seen: c.seen,
      p_event_id: `asc:${c.submissionId}`,
    })
    if (error) console.error('[cron/ios-crashes] record failed', error.code)
    else recorded += 1
  }
  return NextResponse.json({ ok: true, found: crashes.length, recorded })
}

// pg_cron + pg_net calls with POST; Vercel crons call GET. Same handler, same auth.
export const POST = GET
