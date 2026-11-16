import { createServiceRoleClient } from '@/lib/supabase/service'
import { cachedSetting } from '@/lib/server/platformCache'

/** What a grounded web search costs beyond tokens, in millionths of a dollar. Google bills it per grounded request after its free quota. */
export const DEFAULT_GROUNDED_SEARCH_MICRO = 14_000

const TTL_MS = 300_000
let cached: { at: number; micro: number } | null = null

/** The `ai_pricing` platform setting, read at most every five minutes per server instance; a failed read falls back to the default. */
export async function groundedSearchCostMicro(): Promise<number> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.micro
  let micro = DEFAULT_GROUNDED_SEARCH_MICRO
  try {
    const value = await cachedSetting(['ai_pricing'], async () => {
      const { data, error } = await createServiceRoleClient().from('platform_settings').select('value').eq('key', 'ai_pricing').maybeSingle()
      if (error) throw new Error(error.message)
      return data?.value ?? null
    })
    const v = (value as { groundedSearchUsdMicro?: unknown } | null)?.groundedSearchUsdMicro
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) micro = Math.round(v)
  } catch {
    /* keep the default */
  }
  cached = { at: Date.now(), micro }
  return micro
}

/** Test hook. */
export function resetPricingCache(): void {
  cached = null
}
