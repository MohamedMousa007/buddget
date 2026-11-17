import { money, type PriceRegion } from '@/components/features/billing/planBilling'
import type { SparksPackOption } from '@/components/features/membership/SparksPacks'
import type { SparkProduct } from '@/lib/loyalty/rewardsTypes'

/** The owner's Sparks prices (docs/launch/PRO_REWARDS_SPEC.md section 1), shown until the store answers. Qatar has no pack price of its own: USD. */
const USD = { sparks_320: 0.99, sparks_650: 1.99, sparks_2000: 4.99 }
export const SPARK_ANCHORS: Record<PriceRegion, { currency: string; prices: Record<string, number> }> = {
  EG: { currency: 'EGP', prices: { sparks_60: 9.99, sparks_125: 19.99, sparks_320: 49.99, sparks_650: 99.99, sparks_2000: 299.99 } },
  AE: { currency: 'AED', prices: { sparks_320: 3.99, sparks_650: 7.99, sparks_2000: 18.99 } },
  SA: { currency: 'SAR', prices: { sparks_320: 3.99, sparks_650: 7.99, sparks_2000: 21.99 } },
  QA: { currency: 'USD', prices: USD },
  US: { currency: 'USD', prices: USD },
}

export interface PackLists {
  /** The packs always shown. */
  main: SparksPackOption[]
  /** Country-only packs, behind "More packs". */
  extra: SparksPackOption[]
  /** The middle of the main packs: it carries the gold tag and is selected first. */
  popularId: string | undefined
}

/**
 * The packs a person sees. With the store's answer, exactly the packs it sells here at its own prices (a country-only pack the store
 * does not offer is simply absent). Without it, the owner's prices for the region, and a country-only pack only in its country.
 */
export function packLists(products: readonly SparkProduct[], region: PriceRegion, storePrices: ReadonlyMap<string, string> | null, countryTag: string): PackLists {
  const anchors = SPARK_ANCHORS[region]
  const live = storePrices && storePrices.size > 0 ? storePrices : null
  const main: SparksPackOption[] = []
  const extra: SparksPackOption[] = []
  for (const p of [...products].sort((a, b) => a.sparks - b.sparks)) {
    const limited = !!p.countries?.length
    const anchor = anchors.prices[p.id]
    const price = live ? live.get(p.id) : (!limited || p.countries!.includes(region)) && anchor !== undefined ? money(anchors.currency, anchor) : undefined
    if (!price) continue
    if (limited) extra.push({ id: p.id, sparks: p.sparks, price, tag: countryTag })
    else main.push({ id: p.id, sparks: p.sparks, price })
  }
  return { main, extra, popularId: main[Math.floor((main.length - 1) / 2)]?.id }
}
