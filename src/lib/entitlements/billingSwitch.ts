import type { ServiceClient } from '@/lib/supabase/service'

const TTL_MS = 30_000
let cached: { at: number; on: boolean } | null = null

/**
 * The one server-side switch for selling (`platform_settings.billing.enabled`, read through `billing_enabled()`).
 * Off means no paywall, no purchase entry points and no enforcement of paid gates. A failed read counts as off, so a
 * database blink never starts refusing anything; one cheap read per 30 seconds per server instance.
 */
export async function billingEnabled(service: ServiceClient): Promise<boolean> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.on
  try {
    const { data, error } = await service.rpc('billing_enabled')
    if (error) return cached?.on ?? false
    cached = { at: Date.now(), on: data === true }
    return cached.on
  } catch {
    return cached?.on ?? false
  }
}

export function resetBillingSwitchCache(): void {
  cached = null
}
