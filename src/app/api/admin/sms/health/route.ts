import { guardAdmin, json, bad } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 7, 1), 90)
  const { data, error } = await g.ctx.service.rpc('admin_sms_health', { p_days: days })
  if (error) return bad('Could not load SMS health.', 500)
  return json({ days, health: data })
}
