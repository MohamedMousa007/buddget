import { guardAdmin, json, bad, maskIf, readJson } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

const COLUMNS =
  'id, user_id, sender, bank_name, merchant, clean_title, amount, currency, kind, failure_code, parse_method, confidence, raw_body, received_at, is_duplicate, source, account_last4, parsed_ok, expense_id, income_id, pattern_id, payment_instrument, status, pushed_at, push_result, confirmed_at, acked_at, learn_status, learn_template_id, matched_template_id'

const FAILURE_STATUSES = ['failed', 'add_failed']

/**
 * The tracked-SMS log and its error queue. `queue=errors` is everything that needs attention: failed imports plus
 * messages that were logged or notified but never reached the app.
 */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const url = new URL(req.url)
  const queue = url.searchParams.get('queue') ?? 'all'
  const status = url.searchParams.get('status')
  const userId = url.searchParams.get('userId')
  const sender = url.searchParams.get('sender')
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(Math.max(Math.floor(Number(url.searchParams.get('limit'))) || 50, 1), 200)

  let q = ctx.service.from('sms_parse_log').select(COLUMNS).order('received_at', { ascending: false }).limit(limit)
  if (queue === 'errors') {
    const stale = new Date(Date.now() - 2 * 60_000).toISOString()
    q = q.or(`status.in.(${FAILURE_STATUSES.join(',')}),and(status.in.(logged,notified),received_at.lt.${stale})`)
  } else if (queue === 'unparsed') {
    q = q.eq('parsed_ok', false).neq('status', 'rejected')
  }
  if (status) q = q.eq('status', status)
  if (userId && UUID_RE.test(userId)) q = q.eq('user_id', userId)
  if (sender) q = q.ilike('sender', `%${sender.replace(/[%,()]/g, '')}%`)
  if (cursor && !Number.isNaN(Date.parse(cursor))) q = q.lt('received_at', cursor)

  const { data, error } = await q
  if (error) {
    console.error('[admin/sms/logs] list failed', error.message)
    return bad('Could not load SMS logs.', 500)
  }
  const rows = data ?? []

  const ids = [...new Set(rows.map((r) => r.user_id))]
  const emails = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: profiles } = await ctx.service.from('profiles').select('id, email').in('id', ids)
    for (const p of profiles ?? []) emails.set(p.id, p.email)
  }

  return json({
    rows: rows.map((r) => ({ ...r, email: maskIf(ctx, emails.get(r.user_id)) })),
    nextCursor: rows.length === limit ? rows[rows.length - 1]!.received_at : null,
  })
}

/** Turn a failing message into a support ticket so it is tracked to resolution. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'support.reply' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ op?: string; id?: string }>(req)
  if (body?.op !== 'create_ticket' || typeof body.id !== 'string' || !UUID_RE.test(body.id)) return bad('Unknown action.')

  const { data: log } = await ctx.service.from('sms_parse_log').select('id, user_id, sender, status, failure_code, parse_method, raw_body, received_at').eq('id', body.id).maybeSingle()
  if (!log) return bad('SMS not found.', 404)
  const { data: profile } = await ctx.service.from('profiles').select('email').eq('id', log.user_id).maybeSingle()

  const { data: ticket, error } = await ctx.service
    .from('support_tickets')
    .insert({
      user_id: log.user_id,
      requester_email: profile?.email ?? null,
      subject: `SMS import problem${log.sender ? ` — ${log.sender}` : ''}`.slice(0, 200),
      category: 'sms',
      priority: 'normal',
      source: 'sms_queue',
      tags: [log.failure_code ?? log.status ?? 'sms'].filter(Boolean) as string[],
    })
    .select('id, number')
    .single()
  if (error || !ticket) return bad('Could not create the ticket.', 500)
  await ctx.service.from('support_ticket_messages').insert({
    ticket_id: ticket.id,
    author_type: 'system',
    author_label: 'SMS queue',
    internal: true,
    body: `Status: ${log.status}\nFailure: ${log.failure_code ?? '—'}\nMethod: ${log.parse_method ?? '—'}\nReceived: ${log.received_at}\n\n${log.raw_body}`.slice(0, 10000),
  })
  await ctx.audit('support.ticket_from_sms', { targetType: 'ticket', targetId: ticket.id, summary: `Opened ticket #${ticket.number} from SMS log` })
  return json({ ok: true, ticketId: ticket.id, number: ticket.number })
}
