import type { createServiceRoleClient } from '@/lib/supabase/service'
import { invalidateCuratedDbCache } from '@/lib/sms/curatedDbCache'
import { replayCandidate, type ReplayCase } from '@/lib/sms/replayHarness'
import type { MappingRules } from '@/lib/sms/templateApply'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

interface PromotionConfig {
  min_match_count: number
  min_unique_users: number
  min_age_days: number
  max_failure_rate: number
  min_avg_confidence: number
}

interface CachedConfig {
  config: PromotionConfig
  expiry: number
}

let configCache: CachedConfig | null = null
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000

async function getPromotionConfig(service: ServiceClient): Promise<PromotionConfig | null> {
  if (configCache && Date.now() < configCache.expiry) return configCache.config

  const { data } = await service
    .from('sms_promotion_config')
    .select('min_match_count, min_unique_users, min_age_days, max_failure_rate, min_avg_confidence')
    .eq('id', 1)
    .single()

  if (!data) return null
  configCache = { config: data as PromotionConfig, expiry: Date.now() + CONFIG_CACHE_TTL_MS }
  return data as PromotionConfig
}

export function invalidateConfigCache(): void {
  configCache = null
}

export async function checkAndAutoPromote(
  sender: string,
  service: ServiceClient,
  opts: { loadReplayCases?: (sender: string) => Promise<readonly ReplayCase[]> } = {},
): Promise<void> {
  try {
    const config = await getPromotionConfig(service)
    if (!config) return

    const { data: eligible } = await service
      .rpc('check_sms_promotion_eligibility')

    if (!eligible?.length) return

    const senderEligible = (eligible as Array<{ template_id: string; sender: string }>)
      .filter((row) => row.sender === sender)

    if (!senderEligible.length) return

    // LF5: replay known shapes (masked corpus + golden fixtures) before a template becomes global.
    // Infrastructure trouble loading cases means no cases (check skipped), never a blocked promotion.
    const replayCases = await Promise.resolve(opts.loadReplayCases?.(sender)).then((c) => c ?? [], () => [] as readonly ReplayCase[])

    for (const row of senderEligible) {
      if (replayCases.length) {
        const { data: tpl } = await service
          .from('sms_tracking_templates_ai')
          .select('regex_pattern, mapping_rules')
          .eq('id', row.template_id)
          .single()
        if (!tpl) continue
        const report = replayCandidate({ regex: tpl.regex_pattern, rules: tpl.mapping_rules as unknown as MappingRules }, replayCases)
        if (!report.ok) {
          console.warn('[promotionChecker] promotion blocked by replay regression', { template_id: row.template_id, regressions: report.regressions.length })
          continue
        }
      }
      const { error } = await service
        .from('sms_tracking_templates_ai')
        .update({
          tier: 'curated_db',
          auto_promoted: true,
          promoted_at: new Date().toISOString(),
        })
        .eq('id', row.template_id)

      if (!error) {
        // Promotion changes REACH (author-scoped -> global), so the cached trusted set is now
        // stale and would keep excluding this template until the TTL expired.
        invalidateCuratedDbCache()
        console.log('[promotionChecker] auto-promoted template', { template_id: row.template_id, sender })
      }
    }
  } catch (e) {
    console.warn('[promotionChecker] auto-promote check failed', e)
  }
}
