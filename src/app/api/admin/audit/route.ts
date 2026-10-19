import { guardAdmin, json, bad } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'audit.view' })
  if (!g.ok) return g.res
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)
  const action = url.searchParams.get('action')
  const actor = url.searchParams.get('actor')
  const cursor = Number(url.searchParams.get('cursor')) || null

  let q = g.ctx.service.from('admin_audit_log').select('id, actor_id, actor_email, action, target_type, target_id, summary, metadata, ip, created_at').order('id', { ascending: false }).limit(limit)
  if (action) q = q.ilike('action', `${action.replace(/[%,()]/g, '')}%`)
  if (actor) q = q.ilike('actor_email', `%${actor.replace(/[%,()]/g, '')}%`)
  if (cursor) q = q.lt('id', cursor)
  const { data, error } = await q
  if (error) return bad('Could not load the audit log.', 500)
  return json({ rows: data ?? [], nextCursor: data && data.length === limit ? data[data.length - 1]!.id : null })
}
