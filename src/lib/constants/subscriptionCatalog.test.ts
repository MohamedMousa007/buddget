import { describe, expect, it } from 'vitest'
import {
  CATALOG_REGIONS,
  REGION_CURRENCY,
  SUBSCRIPTION_CATALOG,
  detectCatalogRegion,
  filterVisibleBrands,
  plansForRegion,
  resolveBrandKeyFromMerchant,
  type SubscriptionBrand,
} from './subscriptionCatalog'

/**
 * A false brand match is expensive: dispatch force-overrides the category to
 * `Subscription` and links the expense, so a wrong hit miscategorises a real purchase AND
 * corrupts a subscription's payment history.
 */
describe('resolveBrandKeyFromMerchant', () => {
  it.each([
    ['NETFLIX.COM', 'netflix'],
    ['NETFLIX.COM 866-579-7172', 'netflix'],
    ['Netflix', 'netflix'],
    ['Spotify AB', 'spotify'],
    ['OPENAI *CHATGPT', 'chatgpt_plus'],
    ['ANTHROPIC', 'claude_pro'],
    ['OSN PLUS', 'osn_plus'],
    ['osn+', 'osn_plus'],
  ])('resolves %s -> %s', (merchant, key) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBe(key)
  })

  // The regression: `osn` is a 3-char alias, so a bare `includes` matched inside "bosnia".
  // A length>=3 guard alone does NOT fix this — the token is exactly 3.
  it.each([
    ['Bosnia Air', 'a short alias inside a longer word'],
    ['BOSNIAN RESTAURANT', 'the same, upper case'],
    ['Carrefour Egypt', 'an ordinary supermarket'],
    ['LA ROSE PASTRY', 'an ordinary merchant'],
    ['EL Wahat for oil', 'an ordinary merchant'],
    ['ATM Withdrawal', 'a non-purchase description'],
  ])('does not resolve %s (%s)', (merchant) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBeNull()
  })

  it('does not let a mere fragment of a brand name claim the brand', () => {
    // The old resolver also tried keyToken.includes(norm), so "net" claimed Netflix.
    expect(resolveBrandKeyFromMerchant('net')).toBeNull()
    expect(resolveBrandKeyFromMerchant('Spot')).toBeNull()
  })

  it('prefers the most specific brand when tokens overlap', () => {
    expect(resolveBrandKeyFromMerchant('AMAZON PRIME')).toBe('prime_video')
  })

  it.each([null, undefined, '', '   ', '!!!'])('returns null for %p', (input) => {
    expect(resolveBrandKeyFromMerchant(input)).toBeNull()
  })
})

describe('detectCatalogRegion', () => {
  it.each([
    ['Saudi Arabia', '', 'saudi'],
    ['KSA', '', 'saudi'],
    ['', 'Riyadh', 'saudi'],
    ['', 'Jeddah', 'saudi'],
    ['', 'Dammam', 'saudi'],
    ['السعودية', '', 'saudi'],
    ['UAE', '', 'uae'],
    ['', 'Dubai', 'uae'],
    ['Egypt', '', 'egypt'],
    ['', 'Cairo', 'egypt'],
    ['مصر', '', 'egypt'],
  ])('country=%p city=%p -> %s', (country, city, expected) => {
    expect(detectCatalogRegion({ country, city })).toBe(expected)
  })

  it('returns null when it genuinely cannot tell', () => {
    expect(detectCatalogRegion({ country: 'France', city: 'Paris' })).toBeNull()
    expect(detectCatalogRegion({})).toBeNull()
  })

  // Without a branch here, adding 'saudi' to the type makes the region unreachable and
  // every Saudi brand becomes dead data.
  it('can reach every region it declares', () => {
    const reachable = new Set(
      [
        detectCatalogRegion({ country: 'UAE' }),
        detectCatalogRegion({ country: 'Egypt' }),
        detectCatalogRegion({ country: 'Saudi Arabia' }),
      ].filter(Boolean),
    )
    expect([...reachable].sort()).toEqual([...CATALOG_REGIONS].sort())
  })
})

describe('REGION_CURRENCY', () => {
  it('covers every region — a missing entry must not be silently undefined', () => {
    for (const region of CATALOG_REGIONS) {
      expect(REGION_CURRENCY[region]).toBeTruthy()
    }
  })

  it('maps saudi to SAR', () => {
    expect(REGION_CURRENCY.saudi).toBe('SAR')
  })
})

describe('filterVisibleBrands', () => {
  const brand = (availability: SubscriptionBrand['availability']): SubscriptionBrand =>
    ({ key: 'k', name: 'n', color: '', emoji: '', initial: '', defaultCategory: 'Enjoyment',
       catalogSection: 'catOther', availability, plans: {} }) as SubscriptionBrand

  it('filters to the requested region', () => {
    const all = [brand(['saudi']), brand(['egypt'])]
    expect(filterVisibleBrands(all, 'saudi')).toHaveLength(1)
  })

  it('shows a Saudi-only brand to a Saudi user', () => {
    // The old hardcoded `uae && egypt` global rule made this unreachable.
    expect(filterVisibleBrands([brand(['saudi'])], 'saudi')).toHaveLength(1)
  })

  it('with no known region, shows only brands available in EVERY region', () => {
    const everywhere = brand([...CATALOG_REGIONS])
    const twoOfThree = brand(['uae', 'egypt'])
    expect(filterVisibleBrands([everywhere, twoOfThree], null)).toEqual([everywhere])
  })
})

describe('plansForRegion', () => {
  const b = { plans: { egypt: [{ name: 'Std', amount: 200, cycle: 'monthly' }] } } as unknown as SubscriptionBrand

  it('returns the region plans', () => {
    expect(plansForRegion(b, 'egypt')).toHaveLength(1)
  })

  it('degrades to none for an unpriced region rather than another region price', () => {
    expect(plansForRegion(b, 'saudi')).toEqual([])
  })

  it('degrades to none when the region is unknown', () => {
    expect(plansForRegion(b, null)).toEqual([])
  })
})

describe('catalog data integrity', () => {
  it('every brand key is unique', () => {
    const keys = SUBSCRIPTION_CATALOG.map((b) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every brand declares at least one region', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      expect(b.availability.length, `${b.key} has no availability`).toBeGreaterThan(0)
    }
  })

  it('every declared availability is a real region', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      for (const r of b.availability) {
        expect(CATALOG_REGIONS, `${b.key} declares ${r}`).toContain(r)
      }
    }
  })

  it('never prices a region the brand is not available in', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      for (const region of Object.keys(b.plans) as (keyof typeof b.plans)[]) {
        if ((b.plans[region] ?? []).length === 0) continue
        expect(b.availability, `${b.key} prices ${region} but is not available there`).toContain(region)
      }
    }
  })
})
