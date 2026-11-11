import { guardAdmin, json, maskIf } from '@/lib/server/admin/guard'
import { auditPiiRead } from '@/lib/server/admin/staffActionGuards'

interface DirectoryRow {
  id: string
  email: string | null
  name: string | null
  [key: string]: unknown
}

/** `offset=1e999` parses to Infinity, which the RPC rejects with a 500. */
const MAX_OFFSET = 1_000_000
const ORDERS = new Set(['created_desc', 'created_asc', 'active_desc', 'expenses_desc', 'email_asc'])
const STATES = new Set(['banned', 'unconfirmed', 'sms', 'inactive'])

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'users.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const url = new URL(req.url)
  const order = url.searchParams.get('order') ?? 'created_desc'
  const state = url.searchParams.get('state')

  const search = url.searchParams.get('q') || undefined
  const { data, error } = await ctx.service.rpc('admin_user_directory', {
    p_search: search,
    // Without `users.pii` the email is matched in its masked form only, so a search cannot recover what the response hides.
    p_match_email: ctx.canSeePii,
    p_limit: Math.min(Math.max(Math.floor(Number(url.searchParams.get('limit'))) || 25, 1), 100),
    p_offset: Math.min(Math.max(Math.floor(Number(url.searchParams.get('offset'))) || 0, 0), MAX_OFFSET),
    p_order: ORDERS.has(order) ? order : 'created_desc',
    p_plan: url.searchParams.get('plan') || undefined,
    p_state: state && STATES.has(state) ? state : undefined,
  })
  if (error) {
    console.error('[admin/users] directory failed', error.message)
    return json({ error: 'Could not load users.' }, 500)
  }
  const result = data as { total: number; rows: DirectoryRow[] }
  await auditPiiRead(ctx, 'user_list', 'user', null)
  if (search) await auditPiiRead(ctx, 'user_search', 'user', null, { onlyWithPii: false })
  return json({ total: result.total, rows: result.rows.map((r) => ({ ...r, email: maskIf(ctx, r.email) })) })
}
