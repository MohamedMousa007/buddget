import { describe, expect, it } from 'vitest'
import {
  CATALOG_REGIONS,
  CATALOG_SECTION_ORDER,
  REGION_CURRENCY,
  SUBSCRIPTION_CATALOG,
  detectCatalogRegion,
  filterVisibleBrands,
  findBrandByKey,
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

describe('resolveBrandKeyFromMerchant — Arabic merchants', () => {
  it.each([
    ['نتفليكس', 'netflix'],
    ['نتفلكس', 'netflix'],
    ['سبوتيفاي', 'spotify'],
    ['شاهد', 'shahid_vip'],
    ['شَاهِد VIP', 'shahid_vip'],
    ['أنغامي', 'anghami'],
    ['ديزني بلس', 'disney_plus'],
    ['يوتيوب', 'youtube_premium'],
    ['شراء من نتفليكس القاهرة', 'netflix'],
    ['امازون برايم', 'prime_video'],
  ])('resolves %s -> %s', (merchant, key) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBe(key)
  })

  it.each([['سوبر ماركت الأمل'], ['مطعم شاهدين'], ['صيدلية العزبي'], ['ك']])('does not resolve %s', (m) => {
    expect(resolveBrandKeyFromMerchant(m)).toBeNull()
  })
})

describe('resolveBrandKeyFromMerchant — guards', () => {
  it('does not resolve a generic gym purchase to the Gym Membership entry', () => {
    expect(resolveBrandKeyFromMerchant('Fitness Gym Maadi')).toBeNull()
    expect(resolveBrandKeyFromMerchant('Gym Club')).toBeNull()
    expect(resolveBrandKeyFromMerchant('Pro Gym')).toBeNull()
  })

  it('resolves a named gym chain to its own brand, never the generic entry', () => {
    expect(resolveBrandKeyFromMerchant("GOLD'S GYM")).toBe('golds_gym')
    expect(resolveBrandKeyFromMerchant('ANYTIME FITNESS DUBAI')).toBe('anytime_fitness')
  })

  it('still resolves the exact catalog name', () => {
    expect(resolveBrandKeyFromMerchant('Gym Membership')).toBe('gym')
  })

  it('does not treat Object.prototype names as aliases', () => {
    expect(resolveBrandKeyFromMerchant('constructor')).toBeNull()
    expect(resolveBrandKeyFromMerchant('toString')).toBeNull()
  })
})

describe('resolveBrandKeyFromMerchant — regional research aliases', () => {
  it.each([
    ['UBER *ONE', 'uber_one'],
    ['TALABAT PRO', 'talabat_pro'],
    ['NOON ONE', 'noon_one'],
    ['NOON VIP', 'noon_one'],
    ['CAREEM PLUS', 'careem_plus'],
    ['WATCH.IT', 'watchit'],
    ['BEIN CONNECT', 'bein_sports'],
    ['GOOGLE *YOUTUBE MUSIC', 'youtube_music'],
    ['GOOGLE *YOUTUBE PREMIUM', 'youtube_premium'],
    ['MICROSOFT*XBOX', 'xbox_gamepass'],
    ['PLAYSTATION NETWORK', 'playstation_plus'],
    ['SONY INTERACTIVE ENTERTAINMENT', 'playstation_plus'],
    ['NORDSEC', 'nordvpn'],
    ['LINKEDIN SN', 'linkedin_premium'],
    ['ADOBE SYSTEMS', 'adobe_creative_cloud'],
    ['CANVA PTY', 'canva'],
    ['DUOLINGO SUPER', 'duolingo'],
    ['X CORP', 'x_premium'],
    ['VODAFONE EGYPT', 'vodafone_eg'],
    ['ANA VODAFONE', 'vodafone_eg'],
    ['MY ORANGE', 'orange_eg'],
    ['TELECOM EGYPT', 'we_internet'],
    ['ETISALAT MISR', 'etisalat_eg'],
    ['ETISALAT ELIFE', 'etisalat_uae'],
    ['MOBILY', 'mobily'],
    ['ETIHAD ETISALAT', 'mobily'],
    ['MOBILY FIBER', 'mobily_home'],
    ['STC PLAY', 'stc_tv'],
    ['STC BAITY', 'stc_home'],
    ['LEEJAM SPORTS', 'fitness_time'],
    ['HUNGERSTATION', 'hungerstation'],
    ['EMIRATES INTEGRATED TELECOMMUNICATIONS', 'du_mobile'],
    ['Medium.com', 'medium'],
    ['CALM.COM', 'calm'],
  ])('resolves %s -> %s', (merchant, key) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBe(key)
  })

  // The bare words are far bigger merchants than the membership they would claim. A false hit
  // renames the purchase and seeds its category from the brand.
  it.each([
    ['UBER TRIP'],
    ['Uber'],
    ['NOON.COM'],
    ['NOON GROCERIES'],
    ['CAREEM RIDE'],
    ['TALABAT ORDER'],
    ['Orange Juice Corner'],
    ['Etisalat'],
    ['Calm Cafe'],
    ['Medium Rare Grill'],
    ['Plus Pharmacy'],
    ['Pro Gym'],
    ['Virgin Megastore'],
    ['Salam Pharmacy'],
  ])('does not resolve the ordinary merchant %s', (merchant) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBeNull()
  })
})

describe('resolveBrandKeyFromMerchant — Arabic regional aliases', () => {
  it.each([
    ['طلبات برو', 'talabat_pro'],
    ['نون ون', 'noon_one'],
    ['كريم بلس', 'careem_plus'],
    ['اوبر ون', 'uber_one'],
    ['واتش ات', 'watchit'],
    ['يوتيوب ميوزك', 'youtube_music'],
    ['فودافون', 'vodafone_eg'],
    ['خصم من فودافون مصر', 'vodafone_eg'],
    ['اورنج مصر', 'orange_eg'],
    ['اتصالات مصر', 'etisalat_eg'],
    ['اتصالات الإمارات', 'etisalat_uae'],
    ['المصرية للاتصالات', 'we_internet'],
    ['موبايلي', 'mobily'],
    ['زين السعودية', 'zain_ksa'],
    ['اس تي سي', 'stc'],
    ['اس تي سي بلاي', 'stc_tv'],
    ['هنقرستيشن', 'hungerstation'],
    ['فتنس تايم', 'fitness_time'],
    ['جولدز جيم', 'golds_gym'],
    ['كانفا', 'canva'],
  ])('resolves %s -> %s', (merchant, key) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBe(key)
  })

  it.each([['طلبات'], ['اورنج'], ['زين'], ['جاهز'], ['نادي'], ['مطعم زين']])('does not resolve the ordinary word %s', (m) => {
    expect(resolveBrandKeyFromMerchant(m)).toBeNull()
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

  // An EMPTY availability is legal and meaningful: the brand is not sold in any region we
  // serve (Hulu/Peacock are US-only; HBO Max is blocked across MENA by OSN's exclusive
  // rights). filterVisibleBrands hides it, while findBrandByKey still resolves it so an
  // existing subscription keeps its name and icon.
  it('hides a brand that is not sold in any region we serve', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      if (b.availability.length > 0) continue
      for (const region of CATALOG_REGIONS) {
        expect(filterVisibleBrands([b], region), `${b.key} is unavailable but shown in ${region}`).toEqual([])
      }
      expect(filterVisibleBrands([b], null)).toEqual([])
      expect(Object.keys(b.plans), `${b.key} is unavailable but priced`).toEqual([])
    }
  })

  it('every declared availability is a real region', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      for (const r of b.availability) {
        expect(CATALOG_REGIONS, `${b.key} declares ${r}`).toContain(r)
      }
    }
  })

  it('gives the same plan the same id in every region — the cross-region join key', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      const byName = new Map<string, string>()
      for (const plans of Object.values(b.plans)) {
        for (const p of plans ?? []) {
          const seen = byName.get(p.name)
          if (seen) expect(p.id, `${b.key} plan "${p.name}" has ids ${seen} and ${p.id}`).toBe(seen)
          else byName.set(p.name, p.id)
        }
      }
    }
  })

  it('never reuses one plan id for two different plans of a brand', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      const idToName = new Map<string, string>()
      for (const plans of Object.values(b.plans)) {
        for (const p of plans ?? []) {
          const seen = idToName.get(p.id)
          if (seen) expect(p.name, `${b.key} id "${p.id}" maps to ${seen} and ${p.name}`).toBe(seen)
          else idToName.set(p.id, p.name)
        }
      }
    }
  })

  it('scopes every plan id to its own brand, so ids cannot collide across brands', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      for (const plans of Object.values(b.plans)) {
        for (const p of plans ?? []) {
          expect(p.id.startsWith(`${b.key}_`), `${b.key} has foreign plan id ${p.id}`).toBe(true)
        }
      }
    }
  })

  it('quotes a fixed-currency plan identically in every region', () => {
    // A plan billed in a fixed currency worldwide (USD software) cannot have a different
    // number per region — that would mean someone hand-converted it, which is the FX rot
    // the currency field exists to end (ChatGPT Plus sat at 300 EGP for a $20 plan).
    for (const b of SUBSCRIPTION_CATALOG) {
      const byId = new Map<string, number>()
      for (const plans of Object.values(b.plans)) {
        for (const p of plans ?? []) {
          if (!p.currency) continue
          const seen = byId.get(p.id)
          if (seen !== undefined) expect(p.amount, `${p.id} differs by region despite a fixed currency`).toBe(seen)
          else byId.set(p.id, p.amount)
        }
      }
    }
  })

  it('dates every price it claims to have verified', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      for (const plans of Object.values(b.plans)) {
        for (const p of plans ?? []) {
          if (!p.verifiedAt) continue
          expect(p.verifiedAt, `${p.id} has a malformed verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        }
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

const CYCLES = ['monthly', 'quarterly', 'yearly', 'weekly']
const CURRENCIES = ['AED', 'EGP', 'SAR', 'USD']
const EXPENSE_CATEGORIES = [
  'Rent', 'Transport', 'Food', 'Enjoyment', 'Savings', 'Debt', 'Remittance', 'Instapay', 'Groceries', 'Fuel',
  'Health', 'Shopping', 'Education', 'Utilities', 'Subscription', 'Other',
]

const allPlans = SUBSCRIPTION_CATALOG.flatMap((b) =>
  CATALOG_REGIONS.flatMap((region) => plansForRegion(b, region).map((plan) => ({ brand: b, region, plan }))),
)

describe('catalog data integrity — every brand and plan', () => {
  it.each(SUBSCRIPTION_CATALOG.map((b) => [b.key, b] as const))('brand %s is well formed', (_key, b) => {
    expect(b.key, 'key shape').toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/)
    expect(b.name.trim()).not.toBe('')
    expect(b.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(b.initial.trim()).not.toBe('')
    expect(b.emoji.trim()).not.toBe('')
    expect(EXPENSE_CATEGORIES).toContain(b.defaultCategory)
    expect(CATALOG_SECTION_ORDER).toContain(b.catalogSection)
    expect(new Set(b.availability).size, `${b.key} repeats a region`).toBe(b.availability.length)
    for (const r of b.availability) expect(CATALOG_REGIONS).toContain(r)
    for (const r of Object.keys(b.plans)) expect(CATALOG_REGIONS).toContain(r)
  })

  it('has plans, and every one is complete', () => {
    expect(allPlans.length).toBeGreaterThan(300)
    for (const { brand, region, plan: p } of allPlans) {
      const at = `${brand.key}/${region}/${p.id}`
      expect(p.id.trim(), at).not.toBe('')
      expect(p.name.trim(), at).not.toBe('')
      expect(Number.isFinite(p.amount) && p.amount > 0, `${at} amount ${p.amount}`).toBe(true)
      expect(Math.round(p.amount * 100) / 100, `${at} has sub-cent precision`).toBe(p.amount)
      expect(CYCLES, at).toContain(p.cycle)
      if (p.currency) expect(CURRENCIES, at).toContain(p.currency)
      if (p.verifiedAt) expect(p.verifiedAt, at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('never repeats a plan id inside one brand and region', () => {
    for (const b of SUBSCRIPTION_CATALOG) {
      for (const region of CATALOG_REGIONS) {
        const ids = plansForRegion(b, region).map((p) => p.id)
        expect(new Set(ids).size, `${b.key}/${region} repeats an id`).toBe(ids.length)
      }
    }
  })

  it('only restates a currency when it differs from the region default', () => {
    // A fixed currency equal to the region currency is noise that rots into a wrong number
    // the day the region changes.
    for (const { brand, region, plan: p } of allPlans) {
      if (p.currency) expect(p.currency, `${brand.key}/${region}/${p.id}`).not.toBe(REGION_CURRENCY[region])
    }
  })

  it('does not hand-convert a foreign-currency plan into the local one', () => {
    // Billed in USD means USD: a USD plan must never be priced in USD by one region and in
    // local currency by another under the same id with a different name.
    for (const { brand, plan: p } of allPlans) {
      if (p.currency !== 'USD') continue
      expect(allPlans.filter((x) => x.brand.key === brand.key && x.plan.id === p.id).every((x) => x.plan.name === p.name)).toBe(true)
    }
  })

  it('only claims verification on or after the research date it was checked on', () => {
    for (const { brand, plan: p } of allPlans) {
      if (p.verifiedAt) expect(p.verifiedAt >= '2026-07-17', `${brand.key}/${p.id}`).toBe(true)
    }
  })
})

describe('catalog — 2026-10 regional research', () => {
  const plan = (key: string, region: (typeof CATALOG_REGIONS)[number], id: string) =>
    plansForRegion(findBrandByKey(key)!, region).find((p) => p.id === id)

  it('prices ChatGPT in EGP in Egypt, and keeps the USD web plan in the Gulf', () => {
    expect(plan('chatgpt_plus', 'egypt', 'chatgpt_plus_plus')).toMatchObject({ amount: 999.99 })
    expect(plan('chatgpt_plus', 'egypt', 'chatgpt_plus_plus')?.currency).toBeUndefined()
    expect(plan('chatgpt_plus', 'uae', 'chatgpt_plus_plus')).toMatchObject({ amount: 20, currency: 'USD' })
    expect(plan('chatgpt_plus', 'uae', 'chatgpt_plus_plus_appstore')).toMatchObject({ amount: 79.99 })
    expect(plan('chatgpt_plus', 'saudi', 'chatgpt_plus_plus_appstore')).toMatchObject({ amount: 89.99 })
  })

  it('bills PlayStation Plus in the local store currency in UAE and KSA', () => {
    for (const region of ['uae', 'saudi'] as const) {
      const plans = plansForRegion(findBrandByKey('playstation_plus')!, region)
      expect(plans).toHaveLength(9)
      expect(plans.every((p) => p.currency === undefined), `${region} must not be USD`).toBe(true)
    }
    expect(plan('playstation_plus', 'uae', 'playstation_plus_essential')?.amount).toBe(32.99)
    expect(plan('playstation_plus', 'saudi', 'playstation_plus_essential_yearly')?.amount).toBe(243.99)
  })

  it('quotes OSN+ in USD on the Egyptian web checkout and EGP on carrier billing', () => {
    expect(plan('osn_plus', 'egypt', 'osn_plus_premium_web')).toMatchObject({ amount: 4.99, currency: 'USD' })
    expect(plan('osn_plus', 'egypt', 'osn_plus_standard_carrier')).toMatchObject({ amount: 140 })
    expect(plan('osn_plus', 'uae', 'osn_plus_standard')?.amount).toBe(48.99)
    expect(findBrandByKey('osn_plus')?.availability).toContain('saudi')
  })

  it('corrects the stale prices the research contradicted', () => {
    expect(plan('apple_music', 'uae', 'apple_music_individual')?.amount).toBe(23.99)
    expect(plan('apple_music', 'egypt', 'apple_music_individual')?.amount).toBe(79.99)
    expect(plan('youtube_premium', 'egypt', 'youtube_premium_individual')?.amount).toBe(87.99)
    expect(plan('youtube_premium', 'uae', 'youtube_premium_family')?.amount).toBe(57.99)
    expect(plan('icloud', 'egypt', 'icloud_2tb')?.amount).toBe(599.99)
    expect(plan('disney_plus', 'egypt', 'disney_plus_monthly')?.amount).toBe(79.99)
    expect(plan('stc', 'saudi', 'stc_mofawtar_4')?.amount).toBe(460)
    expect(plan('microsoft_365', 'saudi', 'microsoft_365_personal_yearly')?.amount).toBe(429.99)
  })

  it('drops plans the research showed no longer exist, and prefills nothing for them', () => {
    expect(plansForRegion(findBrandByKey('apple_tv_plus')!, 'egypt')).toEqual([])
    expect(plan('disney_plus', 'egypt', 'disney_plus_yearly')).toBeUndefined()
    expect(plan('osn_plus', 'egypt', 'osn_plus_monthly')).toBeUndefined()
    expect(plan('google_one', 'egypt', 'google_one_2_tb')).toBeUndefined()
    for (const region of ['uae', 'saudi'] as const) {
      expect(plansForRegion(findBrandByKey('xbox_gamepass')!, region), `xbox ${region}`).toEqual([])
    }
  })

  it('keeps unverified brands available but unpriced', () => {
    for (const key of ['noon_one', 'careem_plus', 'coursera', 'calm', 'du_home', 'cursor', 'mubi', 'jahez', 'hungerstation']) {
      const b = findBrandByKey(key)!
      expect(b.availability.length, key).toBeGreaterThan(0)
      expect(Object.values(b.plans).flat(), `${key} must not be prefilled`).toHaveLength(0)
    }
  })

  it('adds the missing Egyptian, Saudi and Emirati brands', () => {
    const expected: Record<string, (typeof CATALOG_REGIONS)[number]> = {
      watchit: 'egypt', talabat_pro: 'egypt', uber_one: 'egypt', canva: 'uae', proton: 'egypt', salam_ksa: 'saudi',
      virgin_ksa: 'saudi', stc_home: 'saudi', mobily_home: 'saudi', stc_tv: 'saudi', fitness_time: 'saudi',
      golds_gym: 'uae', etisalat_uae: 'uae', headspace: 'uae', storytel: 'saudi', deezer: 'uae', discord_nitro: 'uae',
    }
    for (const [key, region] of Object.entries(expected)) {
      expect(findBrandByKey(key)?.availability, key).toContain(region)
    }
    expect(plansForRegion(findBrandByKey('uber_one')!, 'egypt').map((p) => p.amount)).toEqual([85, 850])
    expect(plansForRegion(findBrandByKey('etisalat_uae')!, 'uae')).toHaveLength(7)
  })

  it('adds VAT to the e& eLife prices, which e& lists ex-VAT', () => {
    expect(plan('etisalat_uae', 'uae', 'etisalat_uae_elife_lite_12')?.amount).toBe(313.95)
  })

  it('stamps every plan it re-verified with the research date', () => {
    for (const key of ['netflix', 'spotify', 'prime_video']) {
      for (const region of CATALOG_REGIONS) {
        for (const p of plansForRegion(findBrandByKey(key)!, region)) expect(p.verifiedAt, `${key}/${p.id}`).toBe('2026-10-17')
      }
    }
  })
})

describe('wallet and payment-rail merchants', () => {
  it.each(['VODAFONE CASH', 'Orange Cash top up', 'Fawry', 'InstaPay', 'فودافون كاش'])('%s is not a subscription brand', (m) => {
    expect(resolveBrandKeyFromMerchant(m)).toBeNull()
  })
  it('still resolves the telecom itself', () => {
    expect(resolveBrandKeyFromMerchant('Vodafone Egypt')).toBe('vodafone_eg')
  })
})
