import { findBrandByKey, POPULAR_BRAND_KEYS, SUBSCRIPTION_CATALOG } from '@/lib/constants/subscriptionCatalog'
import type { SubscriptionBrand } from '@/lib/constants/subscriptionCatalog'

/** Brands with a `public/subscription-icons/{key}.png` asset, for the onboarding grid. */
export function brandsForOnboardingGrid(limit = 28): SubscriptionBrand[] {
  const keys: string[] = []
  for (const k of POPULAR_BRAND_KEYS) {
    if (keys.length >= limit) break
    keys.push(k)
  }
  if (keys.length < limit) {
    for (const b of SUBSCRIPTION_CATALOG) {
      if (keys.includes(b.key)) continue
      keys.push(b.key)
      if (keys.length >= limit) break
    }
  }
  const out: SubscriptionBrand[] = []
  for (const k of keys.slice(0, limit)) {
    const b = findBrandByKey(k)
    if (b) out.push(b)
  }
  return out
}
