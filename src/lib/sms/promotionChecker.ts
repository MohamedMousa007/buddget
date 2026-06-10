import type { createServiceRoleClient } from '@/lib/supabase/service'
import { invalidateSenderCache } from './templateCache'

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

    for (const row of senderEligible) {
      const { error } = await service
        .from('sms_tracking_templates_ai')
        .update({
          tier: 'promoted',
          auto_promoted: true,
          promoted_at: new Date().toISOString(),
        })
        .eq('id', row.template_id)

      if (!error) {
        console.log('[promotionChecker] auto-promoted template', { template_id: row.template_id, sender })
        invalidateSenderCache(sender)
      }
    }
  } catch (e) {
    console.warn('[promotionChecker] auto-promote check failed', e)
  }
}
