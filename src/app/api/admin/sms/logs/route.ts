import { can } from '@/lib/admin/permissions'
import { guardAdmin, json, bad, maskIf, readJson } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

const COLUMNS =
  'id, user_id, sender, bank_name, merchant, clean_title, amount, currency, kind, failure_code, parse_method, confidence, raw_body, received_at, is_duplicate, source, account_last4, parsed_ok, expense_id, income_id, pattern_id, payment_instrument, status, pushed_at, push_result, confirmed_at, acked_at, learn_status, learn_template_id, matched_template_id, payment_method_id, balance_after'

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
    // The balance a message reported is financial PII like the raw body: staff see only that one was recorded unless they hold users.pii.
    rows: rows.map((r) => ({ ...r, raw_body: null, has_body: r.raw_body != null, balance_after: can(ctx.permissions, 'users.financial') ? r.balance_after : null, balance_reported: r.balance_after != null, account_linked: r.payment_method_id != null, email: maskIf(ctx, emails.get(r.user_id)) })),
    canReveal: can(ctx.permissions, 'users.financial'),
    nextCursor: rows.length === limit ? rows[rows.length - 1]!.received_at : null,
  })
}

const MIN_REASON = 8
const REVEALS_PER_HOUR = 60

/**
 * `create_ticket` turns a failing message into a support ticket. `reveal` shows one message body to staff who hold
 * `users.financial`: it needs a written reason, is rate limited, and always writes an audit row.
 */
export async function POST(req: Request) {
  const g = await guardAdmin(req)
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ op?: string; id?: string; reason?: string }>(req)
  if (typeof body?.id !== 'string' || !UUID_RE.test(body.id)) return bad('Unknown action.')

  if (body.op === 'reveal') {
    if (!can(ctx.permissions, 'users.financial')) return bad('Your role does not allow this.', 403)
    const reason = body.reason?.trim() ?? ''
    if (reason.length < MIN_REASON) return bad('Write a short reason first.')
    const { data: allowed } = await ctx.service.rpc('api_rate_hit', { p_key: `sms-reveal:${ctx.staff.id}`, p_window_seconds: 3600, p_max_hits: REVEALS_PER_HOUR })
    if (allowed === false) return bad('Too many message reads this hour.', 429)
    const { data: log } = await ctx.service.from('sms_parse_log').select('id, user_id, raw_body').eq('id', body.id).maybeSingle()
    if (!log) return bad('SMS not found.', 404)
    await ctx.audit('pii.sms.reveal', { targetType: 'sms_log', targetId: log.id, summary: 'Read the content of a bank message', metadata: { userId: log.user_id, reason: reason.slice(0, 300) } })
    return json({ ok: true, raw_body: log.raw_body })
  }

  if (body.op !== 'create_ticket') return bad('Unknown action.')
  if (!can(ctx.permissions, 'support.reply')) return bad('Your role does not allow this.', 403)

  const { data: log } = await ctx.service.from('sms_parse_log').select('id, user_id, sender, status, failure_code, parse_method, received_at').eq('id', body.id).maybeSingle()
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
    // The message text is financial content: it stays in the log, behind the reveal, and is never copied into a ticket.
    body: `Status: ${log.status}\nFailure: ${log.failure_code ?? '—'}\nMethod: ${log.parse_method ?? '—'}\nReceived: ${log.received_at}\nSMS log id: ${log.id}`.slice(0, 10000),
  })
  await ctx.audit('support.ticket_from_sms', { targetType: 'ticket', targetId: ticket.id, summary: `Opened ticket #${ticket.number} from SMS log` })
  return json({ ok: true, ticketId: ticket.id, number: ticket.number })
}
