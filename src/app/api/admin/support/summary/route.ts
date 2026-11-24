import { guardAdmin, json } from '@/lib/server/admin/guard'
import { isUnreadForStaff } from '@/lib/support/conversation'

/**
 * The desk's badge: conversations waiting on the team, and how many of those carry a user message no teammate has
 * opened yet. One bounded read on the needs-reply partial index; ids and timestamps only.
 */
export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'support.view' })
  if (!g.ok) return g.res
  const { data } = await g.ctx.service
    .from('support_tickets')
    .select('status, last_message_at, last_message_from, staff_last_read_at')
    .in('status', ['open', 'pending'])
    .eq('last_message_from', 'user')
    .order('last_message_at', { ascending: true })
    .limit(500)
  const rows = data ?? []
  return json({ needsReply: rows.length, unread: rows.filter(isUnreadForStaff).length })
}
