import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'

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

/** A price change closes the current row and opens a new one, so past costs stay explainable. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'ai.cost.manage' })
  if (!g.ok) return g.res
  const body = await readJson<{ model?: string; in?: number; cached?: number; out?: number; note?: string }>(req)
  const prices = [body?.in, body?.cached, body?.out]
  if (!body?.model || prices.some((p) => typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1000)) return bad('Enter valid prices per million tokens.')
  const { service } = g.ctx
  const { data: current } = await service.from('ai_price_book').select('id, provider, audio_usd_per_min').eq('model', body.model).is('effective_to', null).maybeSingle()
  if (!current) return bad('Unknown model.', 404)
  const now = new Date().toISOString()
  await service.from('ai_price_book').update({ effective_to: now }).eq('id', current.id)
  const { error } = await service.from('ai_price_book').insert({
    provider: current.provider, model: body.model, in_usd_per_mtok: body.in!, cached_usd_per_mtok: body.cached!, out_usd_per_mtok: body.out!,
    audio_usd_per_min: current.audio_usd_per_min, effective_from: now, source_note: body.note?.slice(0, 200) ?? 'Edited in the portal',
  })
  if (error) {
    await service.from('ai_price_book').update({ effective_to: null }).eq('id', current.id)
    return bad('Could not save the price.', 500)
  }
  await g.ctx.audit('ai.price_book.update', { targetType: 'ai_model', targetId: body.model, summary: `Set ${body.model} to in $${body.in} / cached $${body.cached} / out $${body.out} per Mtok` })
  return json({ ok: true })
}
