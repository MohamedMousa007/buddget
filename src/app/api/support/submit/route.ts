import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { drainOutbox } from '@/lib/server/integrations/outbox'
import { triage } from '@/lib/support/triage'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'

const PER_HOUR = 10

const bodySchema = z.object({
  chosen: z.enum(['bug', 'idea', 'question']),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).default(''),
  context: z
    .object({
      route: z.string().max(80).optional(),
      locale: z.string().max(10).optional(),
      appVersion: z.string().max(20).optional(),
      platform: z.enum(['ios', 'android', 'web']).optional(),
      device: z.string().max(60).optional(),
    })
    .default({}),
})

/**
 * Support, bug reports and ideas from inside the app. One request creates the ticket, its first message and, for
 * bugs we are sure of, the outbox row Linear is fed from. Nothing here waits on a third party.
 */
export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { chosen, title, description, context } = parsed.data

  const service = createServiceRoleClient()
  if (await isRateLimited(service, `support-submit:${uid}`, 3600, PER_HOUR)) return NextResponse.json({ error: 'Too many requests, try again later' }, { status: 429 })

  // The signed-in address is verified; the profile email is a field the user can type anything into, so it is only a fallback.
  const { data: authUser } = await service.auth.admin.getUserById(uid)
  const { data: profile } = authUser?.user?.email ? { data: null } : await service.from('profiles').select('email').eq('id', uid).maybeSingle()
  const requesterEmail = authUser?.user?.email ?? profile?.email ?? ''
  const t = triage({ chosen, title, body: description })
  const platform = context.platform ?? (['ios', 'android', 'web'].includes(request.headers.get('x-app-platform') ?? '') ? request.headers.get('x-app-platform') : null)
  const version = context.appVersion ?? request.headers.get('x-app-version')

  const { data, error } = await service.rpc('support_submit', {
    p_user: uid,
    p_email: requesterEmail,
    p_kind: t.kind,
    p_subject: title,
    p_body: description || title,
    p_area: t.area ?? '',
    p_severity: t.severity,
    p_state: t.state,
    p_confidence: t.confidence,
    p_platform: platform ?? '',
    p_version: version ?? '',
    p_context: { route: context.route, locale: context.locale, device: context.device },
    p_to_linear: t.toLinear,
  })
  const row = data?.[0]
  if (error || !row) {
    console.error('[support/submit] failed', error?.message)
    return NextResponse.json({ error: 'Could not send that. Try again.' }, { status: 500 })
  }
  // Send the bug to Linear right away; if that fails the row stays queued and the daily sweep retries it.
  if (t.toLinear) after(() => drainOutbox(service, process.env.LINEAR_API_KEY, 1))
  return NextResponse.json({ ok: true, number: row.ticket_number })
}
