import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { isSafeRegexPattern } from '@/lib/sms/safeRegex'
import { can } from '@/lib/admin/permissions'

type Body = {
  op?: string
  id?: string
  patch?: { ai_enabled?: boolean; regex_pattern?: string }
}

const READ_OPS = new Set(['list', 'keyword_pool', 'check_eligibility'])
const TABLE = 'sms_tracking_templates_ai'

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<Body>(req)
  if (!body?.op) return bad('Unknown op.')
  if (!READ_OPS.has(body.op) && !can(ctx.permissions, 'sms.manage')) return bad('Your role does not allow this.', 403)

  const { service } = ctx
  const now = new Date().toISOString()
  const { op, id, patch } = body
  const target = { targetType: 'sms_template', targetId: id }

  if (op === 'list') {
    const { data, error } = await service.from(TABLE).select('*').order('match_count', { ascending: false }).limit(500)
    if (error) return bad('Failed to load templates.', 500)
    return json({ templates: data ?? [] })
  }

  if (op === 'update' && typeof id === 'string') {
    const safe: { updated_at: string; ai_enabled?: boolean; regex_pattern?: string } = { updated_at: now }
    if (typeof patch?.ai_enabled === 'boolean') safe.ai_enabled = patch.ai_enabled
    if (typeof patch?.regex_pattern === 'string') {
      if (!isSafeRegexPattern(patch.regex_pattern)) return bad('Regex is too long or has nested quantifiers.')
      try { new RegExp(patch.regex_pattern) } catch { return bad('Invalid regex pattern.') }
      safe.regex_pattern = patch.regex_pattern
    }
    if (Object.keys(safe).length === 1) return bad('No valid fields to update.')
    const { data, error } = await service.from(TABLE).update(safe).eq('id', id).select().single()
    if (error) return bad('Update failed.', 500)
    await ctx.audit('sms.template_update', { ...target, summary: 'Edited SMS template', metadata: { fields: Object.keys(safe).filter((k) => k !== 'updated_at') } })
    return json({ ok: true, template: data })
  }

  if (op === 'delete' && typeof id === 'string') {
    const { error } = await service.from(TABLE).delete().eq('id', id)
    if (error) return bad('Delete failed.', 500)
    await ctx.audit('sms.template_delete', { ...target, summary: 'Deleted SMS template' })
    return json({ ok: true })
  }

  if (op === 'bulk_toggle' && typeof patch?.ai_enabled === 'boolean') {
    const { error } = await service.from(TABLE).update({ ai_enabled: patch.ai_enabled, updated_at: now }).neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) return bad('Bulk update failed.', 500)
    await ctx.audit('sms.template_bulk_toggle', { summary: `AI ${patch.ai_enabled ? 'enabled' : 'disabled'} on every template` })
    return json({ ok: true })
  }

  if ((op === 'promote' || op === 'demote') && typeof id === 'string') {
    const update = op === 'promote'
      ? { tier: 'curated_db', promoted_at: now, auto_promoted: false, updated_at: now }
      : { tier: 'template', promoted_at: null, auto_promoted: false, updated_at: now }
    const { error } = await service.from(TABLE).update(update).eq('id', id)
    if (error) return bad(`${op === 'promote' ? 'Promote' : 'Demote'} failed.`, 500)
    await ctx.audit(`sms.template_${op}`, { ...target, summary: `${op === 'promote' ? 'Promoted to Curated DB' : 'Demoted to supervised'}` })
    return json({ ok: true })
  }

  if (op === 'keyword_pool') {
    const [kw, sender] = await Promise.all([
      service.from('sms_keyword_pool').select('keyword, lang, hit_count, last_seen').order('hit_count', { ascending: false }).limit(500),
      service.from('sms_sender_pool').select('sender, hit_count, txn_count, last_seen').order('hit_count', { ascending: false }).limit(200),
    ])
    if (kw.error || sender.error) return bad('Failed to load the keyword pool.', 500)
    return json({ keywords: kw.data ?? [], senders: sender.data ?? [] })
  }

  if (op === 'check_eligibility') {
    const { data, error } = await service.rpc('check_sms_promotion_eligibility')
    if (error) return bad('Eligibility check failed.', 500)
    return json({ eligible: data ?? [] })
  }

  return bad('Unknown op.')
}
