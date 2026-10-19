import { invalidateConfigCache } from '@/lib/sms/promotionChecker'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { can } from '@/lib/admin/permissions'

const DEFAULTS = {
  min_match_count: 50,
  min_unique_users: 3,
  min_age_days: 7,
  max_failure_rate: 0.05,
  min_avg_confidence: 0.9,
}

type Config = Partial<Record<
  | 'min_match_count' | 'min_unique_users' | 'min_age_days' | 'max_failure_rate' | 'min_avg_confidence'
  | 'min_matches_before_retire' | 'quarantine_exonerate_after' | 'signals_before_adjudication' | 'max_user_signals_per_day',
  number
>>

const int = (n: number, min: number) => Math.max(min, Math.floor(n))
const unit = (n: number) => Math.max(0, Math.min(1, n))

/** Bounded so no value can break the template state machine (e.g. a 0-agreement exoneration). */
function sanitize(config: Config): Record<string, number> {
  const out: Record<string, number> = {}
  const ints: Array<[keyof Config, number]> = [
    ['min_match_count', 1], ['min_unique_users', 1], ['min_age_days', 0], ['min_matches_before_retire', 1],
    ['quarantine_exonerate_after', 1], ['signals_before_adjudication', 1], ['max_user_signals_per_day', 1],
  ]
  for (const [key, min] of ints) if (typeof config[key] === 'number') out[key] = int(config[key]!, min)
  if (typeof config.max_failure_rate === 'number') out.max_failure_rate = unit(config.max_failure_rate)
  if (typeof config.min_avg_confidence === 'number') out.min_avg_confidence = unit(config.min_avg_confidence)
  return out
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<{ op?: string; config?: Config }>(req)
  if (!body?.op) return bad('Unknown op.')
  if (body.op !== 'get' && !can(ctx.permissions, 'sms.manage')) return bad('Your role does not allow this.', 403)
  const { service } = ctx
  const now = new Date().toISOString()

  if (body.op === 'get') {
    const { data, error } = await service.from('sms_promotion_config').select('*').eq('id', 1).single()
    if (error) return bad('Failed to load config.', 500)
    return json({ config: data })
  }

  if (body.op === 'save' && body.config) {
    const { data, error } = await service.from('sms_promotion_config').update({ ...sanitize(body.config), updated_at: now }).eq('id', 1).select().single()
    if (error) return bad('Save failed.', 500)
    invalidateConfigCache()
    await ctx.audit('sms.promotion_config_saved', { summary: 'Changed SMS promotion criteria', metadata: sanitize(body.config) })
    return json({ ok: true, config: data })
  }

  if (body.op === 'reset_defaults') {
    const { data, error } = await service.from('sms_promotion_config').update({ ...DEFAULTS, updated_at: now }).eq('id', 1).select().single()
    if (error) return bad('Reset failed.', 500)
    invalidateConfigCache()
    await ctx.audit('sms.promotion_config_reset', { summary: 'Reset SMS promotion criteria to defaults' })
    return json({ ok: true, config: data })
  }

  if (body.op === 'run_auto_promote') {
    const { data: eligible, error } = await service.rpc('check_sms_promotion_eligibility')
    if (error) return bad('Eligibility check failed.', 500)
    const rows = (eligible ?? []) as Array<{ template_id: string }>
    let promoted = 0
    for (const row of rows) {
      const { error: e } = await service.from('sms_tracking_templates_ai').update({ tier: 'curated_db', auto_promoted: true, promoted_at: now, updated_at: now }).eq('id', row.template_id)
      if (!e) promoted++
    }
    await ctx.audit('sms.auto_promote_run', { summary: `Promoted ${promoted} of ${rows.length} eligible templates` })
    return json({ ok: true, promoted, eligible: rows.length })
  }

  return bad('Unknown op.')
}
