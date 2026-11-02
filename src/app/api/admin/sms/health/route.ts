import { guardAdmin, json, bad } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 7, 1), 90)
  const { data, error } = await g.ctx.service.rpc('admin_sms_health', { p_days: days })
  if (error) return bad('Could not load SMS health.', 500)
  // How many imported bank messages landed on an account: the number that shows whether balances can be trusted.
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString()
  const smsExpenses = () => g.ctx.service.from('expenses').select('id', { count: 'exact', head: true }).not('sms_log_id', 'is', null).is('deleted_at', null).is('refunded_at', null).gte('created_at', since)
  const [all, placed] = await Promise.all([smsExpenses(), smsExpenses().not('payment_method_id', 'is', null)])
  const attribution = all.error || placed.error ? null : { total: all.count ?? 0, placed: placed.count ?? 0 }
  return json({ days, health: data, attribution })
}
