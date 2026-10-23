import { guardAdmin, json } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'ai.cost.view' })
  if (!g.ok) return g.res
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 30, 1), 90)
  const [report, prices, spend] = await Promise.all([
    g.ctx.service.rpc('admin_ai_cost_daily', { p_days: days }),
    g.ctx.service.rpc('ai_spend_today'),
    g.ctx.service.from('ai_price_book').select('provider, model, in_usd_per_mtok, cached_usd_per_mtok, out_usd_per_mtok, audio_usd_per_min, source_note').is('effective_to', null),
  ])
  if (report.error) return json({ error: 'Could not load AI cost.' }, 500)
  return json({ days, rows: report.data ?? [], prices: prices.data ?? [], spend: spend.data ?? null })
}
