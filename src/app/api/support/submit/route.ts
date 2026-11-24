import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { triage } from '@/lib/support/triage'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/database.types'
import { ownAttachments } from '@/lib/support/attachments'

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
      osVersion: z.string().max(30).optional(),
      timezone: z.string().max(60).optional(),
    })
    .default({}),
  attachments: z.unknown().optional(),
})

/**
 * Support, bug reports and ideas from inside the app. One request creates the ticket and its first message; staff
 * read them in the admin portal. Escalation to Linear is postponed (QA-57), so nothing is queued for it.
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
  const attachments = ownAttachments(uid, parsed.data.attachments)
  if (!attachments) return NextResponse.json({ error: 'Invalid attachment' }, { status: 400 })

  const service = createServiceRoleClient()
  if (await isRateLimited(service, `support-submit:${uid}`, 3600, PER_HOUR)) return NextResponse.json({ error: 'Too many requests, try again later' }, { status: 429 })

  // The signed-in address is verified; the profile email is a field the user can type anything into, so it is only a fallback.
  const { data: authUser, error: authError } = await service.auth.admin.getUserById(uid)
  // S8C-05: a deleted account's unexpired token must not reach the insert (it failed on the user foreign key with a 500).
  if (!authUser?.user && (authError?.status === 404 || authError?.code === 'user_not_found')) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
    p_context: { route: context.route, locale: context.locale, device: context.device, osVersion: context.osVersion, timezone: context.timezone },
    p_to_linear: false,
  })
  const row = data?.[0]
  if (error || !row) {
    console.error('[support/submit] failed', error?.message)
    return NextResponse.json({ error: 'Could not send that. Try again.' }, { status: 500 })
  }
  if (attachments.length) {
    const { error: attachError } = await service.from('support_ticket_messages').update({ attachments: attachments as unknown as Json }).eq('ticket_id', row.ticket_id).eq('author_type', 'user')
    if (attachError) console.error('[support/submit] attachments not saved', attachError.message)
  }
  return NextResponse.json({ ok: true, number: row.ticket_number })
}
