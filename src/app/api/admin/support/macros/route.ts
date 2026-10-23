import type { ServiceClient } from '@/lib/supabase/service'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'

const KEY = 'support_macros'
const MAX_MACROS = 50

type Macro = { title: string; body: string }

async function load(service: ServiceClient): Promise<Macro[]> {
  const { data } = await service.from('platform_settings').select('value').eq('key', KEY).maybeSingle()
  const list = (data as { value?: { macros?: Macro[] } } | null)?.value?.macros
  return Array.isArray(list) ? list : []
}

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'support.reply' })
  if (!g.ok) return g.res
  return json({ macros: await load(g.ctx.service) })
}

/** Saved replies live in one platform setting: a handful of short texts, edited rarely. */
export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'support.manage' })
  if (!g.ok) return g.res
  const body = await readJson<{ op?: 'add' | 'remove'; title?: string; text?: string }>(req)
  const title = body?.title?.trim().slice(0, 60)
  if (!title) return bad('Give the reply a name.')
  const macros = await load(g.ctx.service)
  let next: Macro[]
  if (body?.op === 'remove') next = macros.filter((m) => m.title !== title)
  else {
    const text = body?.text?.trim().slice(0, 4000)
    if (!text) return bad('Write the reply text.')
    if (macros.length >= MAX_MACROS && !macros.some((m) => m.title === title)) return bad('Too many saved replies.')
    next = [...macros.filter((m) => m.title !== title), { title, body: text }]
  }
  const { error } = await g.ctx.service.from('platform_settings').upsert({ key: KEY, value: { macros: next }, updated_by: g.ctx.staff.id, updated_at: new Date().toISOString() })
  if (error) return bad('Could not save.', 500)
  await g.ctx.audit('support.macro', { targetType: 'setting', targetId: KEY, summary: `${body?.op === 'remove' ? 'Removed' : 'Saved'} the reply “${title}”` })
  return json({ macros: next })
}
