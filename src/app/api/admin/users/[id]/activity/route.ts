import { bad, guardAdmin, json } from '@/lib/server/admin/guard'
import { UUID_RE } from '@/lib/server/admin/targets'

type Params = { params: Promise<{ id: string }> }

type Tone = 'neutral' | 'good' | 'warn' | 'bad'
interface TimelineEvent {
  at: string
  source: 'app' | 'sms' | 'notification' | 'support' | 'staff'
  title: string
  detail?: string
  tone: Tone
}

const APP_EVENTS: Record<string, string> = {
  session_start: 'Opened the app',
  heartbeat: 'Active in the app',
  visibility_visible: 'Returned to the app',
}

/** One merged, newest-first log of everything we know about a user — the support agent's first stop. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'users.logs' })
  if (!g.ok) return g.res
  const { service } = g.ctx

  const [app, sms, notifications, tickets, audit] = await Promise.all([
    service.from('app_analytics_events').select('event_type, created_at, metadata').eq('user_id', id).neq('event_type', 'heartbeat').order('created_at', { ascending: false }).limit(60),
    service.from('sms_parse_log').select('id, sender, status, parsed_ok, failure_code, parse_method, amount, currency, merchant, received_at').eq('user_id', id).order('received_at', { ascending: false }).limit(60),
    service.from('notifications').select('title, message, type, is_read, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    service.from('support_tickets').select('number, subject, status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    service.from('admin_audit_log').select('action, summary, actor_email, created_at').eq('target_type', 'user').eq('target_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  const events: TimelineEvent[] = []
  for (const e of app.data ?? []) {
    events.push({ at: e.created_at, source: 'app', title: APP_EVENTS[e.event_type] ?? e.event_type, tone: 'neutral' })
  }
  for (const s of sms.data ?? []) {
    const failed = s.status === 'failed' || s.status === 'add_failed'
    events.push({
      at: s.received_at,
      source: 'sms',
      title: failed ? `SMS failed to import${s.failure_code ? ` (${s.failure_code})` : ''}` : s.status === 'rejected' ? 'SMS ignored (not a transaction)' : s.parsed_ok ? 'SMS imported' : `SMS ${s.status ?? 'received'}`,
      detail: [s.sender, s.merchant, s.amount != null ? `${s.amount} ${s.currency ?? ''}`.trim() : null, s.parse_method].filter(Boolean).join(' · '),
      tone: failed ? 'bad' : s.parsed_ok ? 'good' : 'neutral',
    })
  }
  for (const n of notifications.data ?? []) {
    events.push({ at: n.created_at, source: 'notification', title: `Notification: ${n.title}`, detail: n.message, tone: n.type === 'error' ? 'bad' : n.type === 'warning' ? 'warn' : 'neutral' })
  }
  for (const t of tickets.data ?? []) {
    events.push({ at: t.created_at, source: 'support', title: `Ticket #${t.number}: ${t.subject}`, detail: t.status, tone: 'neutral' })
  }
  for (const a of audit.data ?? []) {
    events.push({ at: a.created_at, source: 'staff', title: a.summary ?? a.action, detail: a.actor_email ?? undefined, tone: 'warn' })
  }
  events.sort((a, b) => b.at.localeCompare(a.at))
  return json({ events: events.slice(0, 150) })
}
