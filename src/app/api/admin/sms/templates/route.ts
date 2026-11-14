import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { isSafeRegexPattern } from '@/lib/sms/safeRegex'
import { can } from '@/lib/admin/permissions'
import { invalidateCuratedDbCache } from '@/lib/sms/curatedDbCache'
import { loadReplayCases } from '@/lib/sms/replayLoader'
import { replayCandidate } from '@/lib/sms/replayHarness'
import type { MappingRules } from '@/lib/sms/templateApply'
import type { AdminContext } from '@/lib/server/admin/guard'

type Body = {
  op?: string
  id?: string
  patch?: { ai_enabled?: boolean; regex_pattern?: string }
}

const READ_OPS = new Set(['list', 'keyword_pool', 'check_eligibility', 'candidates'])
const TABLE = 'sms_tracking_templates_ai'

type Service = AdminContext['service']

/** Marks the transactions a revoked template created so they get a second look. Returns how many were flagged. */
async function flagTemplateRows(service: Service, templateId: string, nowIso: string): Promise<number> {
  const { data, error } = await (service.from('sms_parse_log') as unknown as {
    update: (row: Record<string, unknown>) => {
      eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { is: (c: string, v: null) => { select: (c: string) => Promise<{ data: unknown[] | null; error: unknown }> } } }
    }
  }).update({ template_revoked_at: nowIso }).eq('matched_template_id', templateId).eq('parsed_ok', true).is('template_revoked_at', null).select('id')
  return error ? 0 : (data?.length ?? 0)
}

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
    if (safe.ai_enabled === false) {
      invalidateCuratedDbCache()
      const flagged = await flagTemplateRows(service, id, now)
      return json({ ok: true, template: data, flagged })
    }
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

  if (op === 'kill' && typeof id === 'string') {
    const { error } = await service.from(TABLE).update({ ai_enabled: false, tier: 'template', promoted_at: null, auto_promoted: false, updated_at: now }).eq('id', id)
    if (error) return bad('Switch off failed.', 500)
    invalidateCuratedDbCache()
    const flagged = await flagTemplateRows(service, id, now)
    await ctx.audit('sms.template_kill', { ...target, summary: 'Switched off SMS template', metadata: { flagged } })
    return json({ ok: true, flagged })
  }

  if (op === 'promote' && typeof id === 'string') {
    const { data: tpl } = await service.from(TABLE).select('sender, regex_pattern, mapping_rules, status, ai_enabled, failure_count, hard_fail').eq('id', id).single()
    if (!tpl) return bad('Template not found.', 404)
    if (tpl.status !== 'active' || !tpl.ai_enabled || tpl.failure_count || tpl.hard_fail) return bad('This template is not active or has recorded failures.')
    const cases = await loadReplayCases(service, tpl.sender)
    const report = replayCandidate({ regex: tpl.regex_pattern, rules: tpl.mapping_rules as unknown as MappingRules }, cases)
    if (!report.ok) return bad(`Replay found ${report.regressions.length} regression(s); not promoted.`)
    const { error } = await service.from(TABLE).update({ tier: 'curated_db', promoted_at: now, auto_promoted: false, updated_at: now }).eq('id', id)
    if (error) return bad('Promote failed.', 500)
    invalidateCuratedDbCache()
    await ctx.audit('sms.template_promote', { ...target, summary: 'Promoted to Curated DB', metadata: { replayChecked: cases.length } })
    return json({ ok: true, replayChecked: cases.length })
  }

  if (op === 'demote' && typeof id === 'string') {
    const { error } = await service.from(TABLE).update({ tier: 'template', promoted_at: null, auto_promoted: false, updated_at: now }).eq('id', id)
    if (error) return bad('Demote failed.', 500)
    invalidateCuratedDbCache()
    const flagged = await flagTemplateRows(service, id, now)
    await ctx.audit('sms.template_demote', { ...target, summary: 'Demoted to supervised', metadata: { flagged } })
    return json({ ok: true, flagged })
  }

  if (op === 'candidates') {
    const { data, error } = await (service as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> }).rpc('sms_promotion_candidates')
    if (error) return bad('Candidate check failed.', 500)
    return json({ candidates: data ?? [] })
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
