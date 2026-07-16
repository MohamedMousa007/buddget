import type { Currency, SubscriptionBillingCycle } from '@/lib/store/types'

export interface SubscriptionPlan {
  /**
   * Stable identity, SHARED across regions — `netflix_standard` is the same plan whether
   * priced in EGP or SAR. That is what makes "which plan is this?" answerable when the
   * user's region changes, and it is the join key the server-side price table needs.
   *
   * Plans were positional (`brand.plans[region][idx]`) and subscriptions persisted only a
   * plan NAME, so reordering the array or editing a label silently repointed or orphaned
   * every stored subscription.
   */
  id: string
  name: string
  amount: number
  /**
   * Currency `amount` is quoted in. Defaults to the region's currency
   * ({@link REGION_CURRENCY}) — set it only when the provider bills a FIXED currency
   * everywhere, as most global software does (ChatGPT, Claude, Slack: USD).
   *
   * Without this, a USD-billed service had to be hand-converted into each region, and
   * those numbers rot as FX moves: ChatGPT Plus sat at 300 EGP for a $20 plan — roughly a
   * third of the truth after the EGP devalued. Storing `{ amount: 20, currency: 'USD' }`
   * once stays correct, and the picker converts at live rates.
   */
  currency?: Currency
  cycle: SubscriptionBillingCycle
  description?: string
  /**
   * ISO date the price was last confirmed against a primary source. Absent means the
   * price predates verification — treat it as a hint, not a fact.
   */
  verifiedAt?: string
}

/**
 * The catalog's regions, as data. Everything region-shaped derives from this array so a
 * new region cannot be silently half-added: `REGION_CURRENCY` becomes a compile error
 * until it is given an entry, and `filterVisibleBrands` picks it up automatically instead
 * of hardcoding which regions count as "global".
 */
export const CATALOG_REGIONS = ['uae', 'egypt', 'saudi'] as const

export type CatalogRegion = (typeof CATALOG_REGIONS)[number]

export type CatalogSectionKey =
  | 'catAiProductivity'
  | 'catStreaming'
  | 'catMusic'
  | 'catCloudStorage'
  | 'catGaming'
  | 'catVpn'
  | 'catFitness'
  | 'catReading'
  | 'catCommunication'
  | 'catTelecom'
  | 'catOther'

export interface SubscriptionBrand {
  key: string
  name: string
  color: string
  emoji: string
  initial: string
  defaultCategory: string
  catalogSection: CatalogSectionKey
  availability: CatalogRegion[]
  /**
   * Partial on purpose: a brand may be available in a region whose pricing we have not
   * verified yet. It degrades to "no prefill", not to a wrong price. (Also the only way to
   * add a region without rewriting all 61 brand literals at once.)
   */
  plans: Partial<Record<CatalogRegion, SubscriptionPlan[]>>
}

/** Resolve which catalog region to use based on user profile. Returns null if unknown. */
export function detectCatalogRegion(profile: { city?: string; country?: string }): CatalogRegion | null {
  const country = (profile.country || '').toLowerCase()
  const city = (profile.city || '').toLowerCase()

  if (
    country.includes('uae') ||
    country.includes('emirates') ||
    country.includes('emirati') ||
    ['dubai', 'abu dhabi', 'sharjah', 'ajman', 'ras al khaimah', 'fujairah', 'umm al quwain'].some((c) =>
      city.includes(c)
    )
  ) {
    return 'uae'
  }

  if (
    country.includes('egypt') ||
    country.includes('مصر') ||
    ['cairo', 'alexandria', 'giza', 'luxor', 'aswan', 'hurghada', 'sharm'].some((c) => city.includes(c))
  ) {
    return 'egypt'
  }

  if (
    country.includes('saudi') ||
    country === 'ksa' ||
    country.includes('السعود') ||
    ['riyadh', 'jeddah', 'mecca', 'makkah', 'medina', 'madinah', 'dammam', 'khobar', 'dhahran', 'tabuk', 'abha'].some(
      (c) => city.includes(c)
    )
  ) {
    return 'saudi'
  }

  return null
}

/** Currency for each catalog region. Total, so a new region cannot be forgotten. */
export const REGION_CURRENCY: Record<CatalogRegion, string> = {
  uae: 'AED',
  egypt: 'EGP',
  saudi: 'SAR',
}

/** Shown first in the catalog (order preserved; only brands also in the filtered list appear). */
export const POPULAR_BRAND_KEYS: readonly string[] = [
  'netflix',
  'spotify',
  'youtube_premium',
  'apple_music',
  'disney_plus',
  'icloud',
  'chatgpt_plus',
  'prime_video',
  'shahid_vip',
  'apple_tv_plus',
]

/**
 * When region is set: only brands available in that region.
 * When region is null (we could not detect where the user is): only brands available
 * EVERYWHERE, since we cannot know which region's availability to trust.
 *
 * Derived from {@link CATALOG_REGIONS} rather than naming regions here. The old version
 * hardcoded `uae && egypt`, which kept compiling after a third region was added while
 * silently meaning the wrong thing — a brand available in all three ranked the same as one
 * available in two, and a Saudi-only brand could never appear.
 */
export function filterVisibleBrands(
  catalog: SubscriptionBrand[],
  region: CatalogRegion | null
): SubscriptionBrand[] {
  if (region) {
    return catalog.filter((b) => b.availability.includes(region))
  }
  return catalog.filter((b) => CATALOG_REGIONS.every((r) => b.availability.includes(r)))
}

export const CATALOG_SECTION_ORDER: CatalogSectionKey[] = [
  'catAiProductivity',
  'catStreaming',
  'catMusic',
  'catCloudStorage',
  'catGaming',
  'catVpn',
  'catFitness',
  'catReading',
  'catCommunication',
  'catTelecom',
  'catOther',
]

export function findBrandByKey(key: string | null): SubscriptionBrand | undefined {
  if (!key) return undefined
  return SUBSCRIPTION_CATALOG.find((b) => b.key === key)
}

/**
 * Verified plans for a region, or none.
 *
 * A brand can be available in a region whose pricing has not been researched yet, so
 * `plans` is partial. Missing pricing must degrade to "no prefill" — the user types the
 * amount, which is what they would verify anyway — never to another region's price.
 */
export function plansForRegion(
  brand: SubscriptionBrand,
  region: CatalogRegion | null
): SubscriptionPlan[] {
  return (region && brand.plans[region]) || []
}

/**
 * Explicit merchant→brandKey aliases for names that don't trivially contain the
 * brand key (e.g. an SMS shows "OPENAI" for ChatGPT). Keys are normalised
 * (lowercase, alphanumeric only).
 */
const MERCHANT_BRAND_ALIASES: Record<string, string> = {
  openai: 'chatgpt_plus',
  chatgpt: 'chatgpt_plus',
  anthropic: 'claude_pro',
  claudeai: 'claude_pro',
  amazonprime: 'prime_video',
  primevideo: 'prime_video',
  googlestorage: 'google_one',
  googleone: 'google_one',
  disneyplus: 'disney_plus',
  appletv: 'apple_tv_plus',
  applemusic: 'apple_music',
  youtubepremium: 'youtube_premium',
  shahid: 'shahid_vip',
  osn: 'osn_plus',
  ms365: 'microsoft_365',
  office365: 'microsoft_365',
}

function normalizeBrandToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Below this a token is not distinctive enough to identify a brand by containment. */
const MIN_CONTAINMENT_TOKEN = 3
/** At/below this a token must land on a word boundary in the ORIGINAL merchant text. */
const SHORT_TOKEN_MAX = 5

/**
 * True when `merchant` genuinely mentions `token`.
 *
 * Short tokens are the danger: `osn` (an alias for OSN+) is a substring of "bosnia", so a
 * plain `includes` resolved a Bosnian merchant to a streaming brand — and because
 * dispatch then force-overrides the category to `Subscription`, a false hit silently
 * miscategorises a real purchase AND corrupts a subscription's payment history. For those,
 * require a word boundary in the raw text, where the spacing still exists: "OSN PLUS" hits,
 * "Bosnia Air" does not.
 */
function merchantMentions(rawMerchant: string, normMerchant: string, token: string): boolean {
  if (token.length < MIN_CONTAINMENT_TOKEN) return false
  if (token.length > SHORT_TOKEN_MAX) return normMerchant.includes(token)
  return new RegExp(`\\b${token}\\b`, 'i').test(rawMerchant)
}

/**
 * Resolves a merchant string (from a parsed SMS) to a catalog brand key, or null.
 *
 * Exact match first, then a guarded containment pass over aliases + catalog key/name,
 * longest token first so the most specific brand wins ("amazonprime" before "prime").
 *
 * Containment is ONE-DIRECTIONAL: the merchant must contain the brand token, never the
 * reverse. The old `keyToken.includes(norm)` direction let a merchant that is merely a
 * fragment of a brand name ("net") claim that brand.
 */
export function resolveBrandKeyFromMerchant(merchant: string | null | undefined): string | null {
  if (!merchant) return null
  const norm = normalizeBrandToken(merchant)
  if (!norm) return null

  if (MERCHANT_BRAND_ALIASES[norm]) return MERCHANT_BRAND_ALIASES[norm]
  for (const b of SUBSCRIPTION_CATALOG) {
    if (normalizeBrandToken(b.key) === norm || normalizeBrandToken(b.name) === norm) return b.key
  }

  const candidates: { token: string; key: string }[] = [
    ...Object.entries(MERCHANT_BRAND_ALIASES).map(([token, key]) => ({ token, key })),
    ...SUBSCRIPTION_CATALOG.flatMap((b) => [
      { token: normalizeBrandToken(b.key), key: b.key },
      { token: normalizeBrandToken(b.name), key: b.key },
    ]),
  ]
    .filter((c) => c.token)
    .sort((a, b) => b.token.length - a.token.length)

  for (const { token, key } of candidates) {
    if (merchantMentions(merchant, norm, token)) return key
  }
  return null
}

export const SUBSCRIPTION_CATALOG: SubscriptionBrand[] = [
  {
    catalogSection: 'catStreaming',
    key: 'netflix',
    name: 'Netflix',
    color: '#E50914',
    emoji: '🎬',
    initial: 'N',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'netflix_basic', name: 'Basic', amount: 35, cycle: 'monthly', description: 'HD, 1 screen' },
        { id: 'netflix_standard', name: 'Standard', amount: 49, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { id: 'netflix_premium', name: 'Premium', amount: 71, cycle: 'monthly', description: '4K UHD, 4 screens' },
      ],
      egypt: [
        { id: 'netflix_basic', name: 'Basic', amount: 70, cycle: 'monthly', description: 'HD, 1 screen' },
        { id: 'netflix_standard', name: 'Standard', amount: 120, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { id: 'netflix_premium', name: 'Premium', amount: 165, cycle: 'monthly', description: '4K UHD, 4 screens' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'shahid_vip',
    name: 'Shahid VIP',
    color: '#00B140',
    emoji: '📺',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'shahid_vip_vip', name: 'VIP', amount: 24, cycle: 'monthly' },
        { id: 'shahid_vip_vip_sports', name: 'VIP Sports', amount: 45, cycle: 'monthly' },
        { id: 'shahid_vip_vip_annual', name: 'VIP Annual', amount: 240, cycle: 'yearly' },
      ],
      egypt: [
        { id: 'shahid_vip_vip', name: 'VIP', amount: 100, cycle: 'monthly' },
        { id: 'shahid_vip_vip_sports', name: 'VIP Sports', amount: 200, cycle: 'monthly' },
        { id: 'shahid_vip_vip_annual', name: 'VIP Annual', amount: 1000, cycle: 'yearly' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'watchit',
    name: 'Watch iT',
    color: '#FF6B00',
    emoji: '🎥',
    initial: 'W',
    defaultCategory: 'Enjoyment',
    availability: ['egypt'],
    plans: {
      uae: [],
      egypt: [
        { id: 'watchit_basic', name: 'Basic', amount: 120, cycle: 'monthly' },
        { id: 'watchit_premium', name: 'Premium', amount: 200, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'disney_plus',
    name: 'Disney+',
    color: '#113CCF',
    emoji: '✨',
    initial: 'D+',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'disney_plus_standard', name: 'Standard', amount: 30, cycle: 'monthly' },
        { id: 'disney_plus_premium', name: 'Premium', amount: 40, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'disney_plus_standard', name: 'Standard', amount: 120, cycle: 'monthly' },
        { id: 'disney_plus_premium', name: 'Premium', amount: 170, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'osn_plus',
    name: 'OSN+',
    color: '#1A1A2E',
    emoji: '📡',
    initial: 'O',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'osn_plus_monthly', name: 'Monthly', amount: 30, cycle: 'monthly' },
        { id: 'osn_plus_annual', name: 'Annual', amount: 300, cycle: 'yearly' },
      ],
      egypt: [
        { id: 'osn_plus_monthly', name: 'Monthly', amount: 120, cycle: 'monthly' },
        { id: 'osn_plus_annual', name: 'Annual', amount: 1200, cycle: 'yearly' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'youtube_premium',
    name: 'YouTube Premium',
    color: '#FF0000',
    emoji: '▶️',
    initial: 'YT',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'youtube_premium_individual', name: 'Individual', amount: 23, cycle: 'monthly' },
        { id: 'youtube_premium_family', name: 'Family', amount: 35, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'youtube_premium_individual', name: 'Individual', amount: 66, cycle: 'monthly' },
        { id: 'youtube_premium_family', name: 'Family', amount: 100, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catMusic',
    key: 'spotify',
    name: 'Spotify',
    color: '#1DB954',
    emoji: '🎵',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'spotify_standard', name: 'Standard', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_platinum', name: 'Platinum', amount: 59.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'spotify_individual', name: 'Individual', amount: 79, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_duo', name: 'Duo', amount: 109, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_family', name: 'Family', amount: 139, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_student', name: 'Student', amount: 39, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'spotify_standard', name: 'Standard', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_platinum', name: 'Platinum', amount: 59.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'spotify_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catMusic',
    key: 'apple_music',
    name: 'Apple Music',
    color: '#FC3C44',
    emoji: '🎶',
    initial: 'AM',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'apple_music_individual', name: 'Individual', amount: 21.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_family', name: 'Family', amount: 33.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_student', name: 'Student', amount: 11.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'apple_music_individual', name: 'Individual', amount: 69.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_family', name: 'Family', amount: 109.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_student', name: 'Student', amount: 34.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'apple_music_individual', name: 'Individual', amount: 21.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_family', name: 'Family', amount: 33.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'apple_tv_plus',
    name: 'Apple TV+',
    color: '#000000',
    emoji: '📺',
    initial: 'tv+',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'apple_tv_plus_monthly', name: 'Monthly', amount: 20, cycle: 'monthly' }],
      egypt: [{ id: 'apple_tv_plus_monthly', name: 'Monthly', amount: 50, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'prime_video',
    name: 'Amazon Prime Video',
    color: '#00A8E1',
    emoji: '📦',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'prime_video_monthly', name: 'Monthly', amount: 16, cycle: 'monthly' }],
      egypt: [{ id: 'prime_video_monthly', name: 'Monthly', amount: 50, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catCloudStorage',
    key: 'icloud',
    name: 'iCloud+',
    color: '#3693F5',
    emoji: '☁️',
    initial: 'iC',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'icloud_50gb', name: '50GB', amount: 3.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_200gb', name: '200GB', amount: 11.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_2tb', name: '2TB', amount: 39.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_6tb', name: '6TB', amount: 119.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_12tb', name: '12TB', amount: 239.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'icloud_50gb', name: '50GB', amount: 39.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_200gb', name: '200GB', amount: 149.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_2tb', name: '2TB', amount: 499.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_6tb', name: '6TB', amount: 1499.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_12tb', name: '12TB', amount: 2999.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'icloud_50gb', name: '50GB', amount: 3.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_200gb', name: '200GB', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_2tb', name: '2TB', amount: 44.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_6tb', name: '6TB', amount: 129.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'icloud_12tb', name: '12TB', amount: 269.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catCloudStorage',
    key: 'google_one',
    name: 'Google One',
    color: '#4285F4',
    emoji: '🔵',
    initial: 'G1',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'google_one_100_gb', name: '100 GB', amount: 7, cycle: 'monthly' },
        { id: 'google_one_2_tb', name: '2 TB', amount: 37, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'google_one_100_gb', name: '100 GB', amount: 30, cycle: 'monthly' },
        { id: 'google_one_2_tb', name: '2 TB', amount: 150, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'chatgpt_plus',
    name: 'ChatGPT Plus',
    color: '#10A37F',
    emoji: '🤖',
    initial: 'AI',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'chatgpt_plus_plus', name: 'Plus', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'chatgpt_plus_plus', name: 'Plus', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'chatgpt_plus_plus', name: 'Plus', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'claude_pro',
    name: 'Claude Pro',
    color: '#D97706',
    emoji: '🧠',
    initial: 'C',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'claude_pro_pro', name: 'Pro', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_pro_annual', name: 'Pro (annual)', amount: 17, currency: 'USD', cycle: 'monthly', description: 'Billed yearly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'claude_pro_pro', name: 'Pro', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_pro_annual', name: 'Pro (annual)', amount: 17, currency: 'USD', cycle: 'monthly', description: 'Billed yearly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'claude_pro_pro', name: 'Pro', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_pro_annual', name: 'Pro (annual)', amount: 17, currency: 'USD', cycle: 'monthly', description: 'Billed yearly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'notion',
    name: 'Notion',
    color: '#000000',
    emoji: '📝',
    initial: 'N',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'notion_plus', name: 'Plus', amount: 10, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'notion_business', name: 'Business', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'notion_plus', name: 'Plus', amount: 10, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'notion_business', name: 'Business', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'notion_plus', name: 'Plus', amount: 10, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'notion_business', name: 'Business', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catFitness',
    key: 'gym',
    name: 'Gym Membership',
    color: '#8B5CF6',
    emoji: '💪',
    initial: 'G',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'gym_monthly', name: 'Monthly', amount: 200, cycle: 'monthly', description: 'Adjust to your gym price' }],
      egypt: [{ id: 'gym_monthly', name: 'Monthly', amount: 500, cycle: 'monthly', description: 'Adjust to your gym price' }],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'playstation_plus',
    name: 'PlayStation Plus',
    color: '#003791',
    emoji: '🎮',
    initial: 'PS',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'playstation_plus_essential', name: 'Essential', amount: 20, cycle: 'monthly' },
        { id: 'playstation_plus_extra', name: 'Extra', amount: 52, cycle: 'monthly' },
        { id: 'playstation_plus_premium', name: 'Premium', amount: 63, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'playstation_plus_essential', name: 'Essential', amount: 80, cycle: 'monthly' },
        { id: 'playstation_plus_extra', name: 'Extra', amount: 215, cycle: 'monthly' },
        { id: 'playstation_plus_premium', name: 'Premium', amount: 260, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'xbox_gamepass',
    name: 'Xbox Game Pass',
    color: '#107C10',
    emoji: '🎮',
    initial: 'XB',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'xbox_gamepass_core', name: 'Core', amount: 28, cycle: 'monthly' },
        { id: 'xbox_gamepass_standard', name: 'Standard', amount: 55, cycle: 'monthly' },
        { id: 'xbox_gamepass_ultimate', name: 'Ultimate', amount: 68, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'xbox_gamepass_core', name: 'Core', amount: 115, cycle: 'monthly' },
        { id: 'xbox_gamepass_standard', name: 'Standard', amount: 230, cycle: 'monthly' },
        { id: 'xbox_gamepass_ultimate', name: 'Ultimate', amount: 280, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catVpn',
    key: 'nordvpn',
    name: 'NordVPN',
    color: '#4687FF',
    emoji: '🔒',
    initial: 'N',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'nordvpn_monthly', name: 'Monthly', amount: 46, cycle: 'monthly' }],
      egypt: [{ id: 'nordvpn_monthly', name: 'Monthly', amount: 190, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'we_internet',
    name: 'WE Internet',
    color: '#7B2D8E',
    emoji: '🌐',
    initial: 'WE',
    defaultCategory: 'Other',
    availability: ['egypt'],
    plans: {
      uae: [],
      egypt: [
        { id: 'we_internet_140_gb', name: '140 GB', amount: 250, cycle: 'monthly' },
        { id: 'we_internet_250_gb', name: '250 GB', amount: 400, cycle: 'monthly' },
        { id: 'we_internet_500_gb', name: '500 GB', amount: 600, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'vodafone_eg',
    name: 'Vodafone Egypt',
    color: '#E60000',
    emoji: '📱',
    initial: 'VF',
    defaultCategory: 'Other',
    availability: ['egypt'],
    plans: {
      uae: [],
      egypt: [
        { id: 'vodafone_eg_flex_100', name: 'Flex 100', amount: 100, cycle: 'monthly' },
        { id: 'vodafone_eg_flex_200', name: 'Flex 200', amount: 200, cycle: 'monthly' },
        { id: 'vodafone_eg_flex_350', name: 'Flex 350', amount: 350, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'orange_eg',
    name: 'Orange Egypt',
    color: '#FF6600',
    emoji: '📱',
    initial: 'OR',
    defaultCategory: 'Other',
    availability: ['egypt'],
    plans: {
      uae: [],
      egypt: [
        { id: 'orange_eg_air_100', name: 'Air 100', amount: 100, cycle: 'monthly' },
        { id: 'orange_eg_air_200', name: 'Air 200', amount: 200, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'etisalat_eg',
    name: 'Etisalat Egypt',
    color: '#509E2F',
    emoji: '📱',
    initial: 'ET',
    defaultCategory: 'Other',
    availability: ['egypt'],
    plans: {
      uae: [],
      egypt: [
        { id: 'etisalat_eg_super_100', name: 'Super 100', amount: 100, cycle: 'monthly' },
        { id: 'etisalat_eg_super_200', name: 'Super 200', amount: 200, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'du_home',
    name: 'du Home Internet',
    color: '#00B5E2',
    emoji: '🌐',
    initial: 'du',
    defaultCategory: 'Other',
    availability: ['uae'],
    plans: {
      uae: [
        { id: 'du_home_starter', name: 'Starter', amount: 299, cycle: 'monthly' },
        { id: 'du_home_plus', name: 'Plus', amount: 449, cycle: 'monthly' },
      ],
      egypt: [],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'etisalat_uae',
    name: 'e& (Etisalat UAE)',
    color: '#509E2F',
    emoji: '📱',
    initial: 'e&',
    defaultCategory: 'Other',
    availability: ['uae'],
    plans: {
      uae: [
        { id: 'etisalat_uae_elife_basic', name: 'eLife Basic', amount: 319, cycle: 'monthly' },
        { id: 'etisalat_uae_elife_plus', name: 'eLife Plus', amount: 449, cycle: 'monthly' },
      ],
      egypt: [],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'du_mobile',
    name: 'du Mobile',
    color: '#00B5E2',
    emoji: '📱',
    initial: 'du',
    defaultCategory: 'Other',
    availability: ['uae'],
    plans: {
      uae: [
        { id: 'du_mobile_postpaid_125', name: 'Postpaid 125', amount: 125, cycle: 'monthly' },
        { id: 'du_mobile_postpaid_200', name: 'Postpaid 200', amount: 200, cycle: 'monthly' },
      ],
      egypt: [],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'hbo_max',
    name: 'HBO Max',
    color: '#5B2EFF',
    emoji: '🎬',
    initial: 'H',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'hbo_max_mobile', name: 'Mobile', amount: 20, cycle: 'monthly', description: 'HD, 1 screen' },
        { id: 'hbo_max_basic', name: 'Basic', amount: 35, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { id: 'hbo_max_platinum', name: 'Platinum', amount: 50, cycle: 'monthly', description: '4K, 4 screens' },
      ],
      egypt: [
        { id: 'hbo_max_mobile', name: 'Mobile', amount: 80, cycle: 'monthly', description: 'HD, 1 screen' },
        { id: 'hbo_max_basic', name: 'Basic', amount: 140, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { id: 'hbo_max_platinum', name: 'Platinum', amount: 200, cycle: 'monthly', description: '4K, 4 screens' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'crunchyroll',
    name: 'Crunchyroll',
    color: '#F47521',
    emoji: '🍥',
    initial: 'C',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'crunchyroll_fan', name: 'Fan', amount: 25, cycle: 'monthly' },
        { id: 'crunchyroll_mega_fan', name: 'Mega Fan', amount: 35, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'crunchyroll_fan', name: 'Fan', amount: 100, cycle: 'monthly' },
        { id: 'crunchyroll_mega_fan', name: 'Mega Fan', amount: 140, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'hulu',
    name: 'Hulu',
    color: '#1CE783',
    emoji: '📺',
    initial: 'H',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'hulu_with_ads', name: 'With ads', amount: 35, cycle: 'monthly' }, { id: 'hulu_no_ads', name: 'No ads', amount: 55, cycle: 'monthly' }],
      egypt: [{ id: 'hulu_with_ads', name: 'With ads', amount: 140, cycle: 'monthly' }, { id: 'hulu_no_ads', name: 'No ads', amount: 220, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'paramount_plus',
    name: 'Paramount+',
    color: '#0064FF',
    emoji: '▶️',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'paramount_plus_essential', name: 'Essential', amount: 20, cycle: 'monthly' }, { id: 'paramount_plus_premium', name: 'Premium', amount: 35, cycle: 'monthly' }],
      egypt: [{ id: 'paramount_plus_essential', name: 'Essential', amount: 80, cycle: 'monthly' }, { id: 'paramount_plus_premium', name: 'Premium', amount: 140, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'peacock',
    name: 'Peacock',
    color: '#000000',
    emoji: '🦚',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'peacock_premium', name: 'Premium', amount: 25, cycle: 'monthly' }, { id: 'peacock_plus', name: 'Plus', amount: 40, cycle: 'monthly' }],
      egypt: [{ id: 'peacock_premium', name: 'Premium', amount: 100, cycle: 'monthly' }, { id: 'peacock_plus', name: 'Plus', amount: 160, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'mubi',
    name: 'Mubi',
    color: '#0D0D0D',
    emoji: '🎞️',
    initial: 'M',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'mubi_monthly', name: 'Monthly', amount: 40, cycle: 'monthly' }],
      egypt: [{ id: 'mubi_monthly', name: 'Monthly', amount: 160, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'starzplay',
    name: 'Starzplay',
    color: '#000000',
    emoji: '⭐',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'starzplay_monthly', name: 'Monthly', amount: 40, cycle: 'monthly' }],
      egypt: [{ id: 'starzplay_monthly', name: 'Monthly', amount: 160, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catMusic',
    key: 'anghami',
    name: 'Anghami',
    color: '#A02F8C',
    emoji: '🎵',
    initial: 'A',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { id: 'anghami_plus', name: 'Plus', amount: 15, cycle: 'monthly' },
        { id: 'anghami_platinum', name: 'Platinum', amount: 25, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'anghami_plus', name: 'Plus', amount: 60, cycle: 'monthly' },
        { id: 'anghami_platinum', name: 'Platinum', amount: 100, cycle: 'monthly' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'tod',
    name: 'TOD',
    color: '#E31837',
    emoji: '⚽',
    initial: 'T',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'tod_entertainment', name: 'Entertainment', amount: 35, cycle: 'monthly' }, { id: 'tod_sports', name: 'Sports', amount: 55, cycle: 'monthly' }],
      egypt: [{ id: 'tod_entertainment', name: 'Entertainment', amount: 140, cycle: 'monthly' }, { id: 'tod_sports', name: 'Sports', amount: 220, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'jawwy_tv',
    name: 'Jawwy TV',
    color: '#FF6600',
    emoji: '📡',
    initial: 'J',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'jawwy_tv_basic', name: 'Basic', amount: 30, cycle: 'monthly' }],
      egypt: [{ id: 'jawwy_tv_basic', name: 'Basic', amount: 120, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'yango_play',
    name: 'Yango Play',
    color: '#FFDD00',
    emoji: '▶️',
    initial: 'Y',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'yango_play_monthly', name: 'Monthly', amount: 25, cycle: 'monthly' }],
      egypt: [{ id: 'yango_play_monthly', name: 'Monthly', amount: 100, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'viu',
    name: 'Viu',
    color: '#FF6A00',
    emoji: '📺',
    initial: 'V',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'viu_premium', name: 'Premium', amount: 20, cycle: 'monthly' }],
      egypt: [{ id: 'viu_premium', name: 'Premium', amount: 80, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'weyyak',
    name: 'Weyyak',
    color: '#E31E24',
    emoji: '🎬',
    initial: 'W',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'weyyak_monthly', name: 'Monthly', amount: 25, cycle: 'monthly' }],
      egypt: [{ id: 'weyyak_monthly', name: 'Monthly', amount: 100, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'cursor',
    name: 'Cursor',
    color: '#1E1E1E',
    emoji: '⌘',
    initial: 'C',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'cursor_pro', name: 'Pro', amount: 80, cycle: 'monthly' }, { id: 'cursor_business', name: 'Business', amount: 120, cycle: 'monthly' }],
      egypt: [{ id: 'cursor_pro', name: 'Pro', amount: 320, cycle: 'monthly' }, { id: 'cursor_business', name: 'Business', amount: 480, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'github_copilot',
    name: 'GitHub Copilot',
    color: '#6E40C9',
    emoji: '🐙',
    initial: 'GH',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'github_copilot_pro', name: 'Pro', amount: 10, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'github_copilot_pro_plus', name: 'Pro+', amount: 39, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'github_copilot_max', name: 'Max', amount: 100, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'github_copilot_pro', name: 'Pro', amount: 10, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'github_copilot_pro_plus', name: 'Pro+', amount: 39, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'github_copilot_max', name: 'Max', amount: 100, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'github_copilot_pro', name: 'Pro', amount: 10, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'github_copilot_pro_plus', name: 'Pro+', amount: 39, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'github_copilot_max', name: 'Max', amount: 100, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'midjourney',
    name: 'Midjourney',
    color: '#000000',
    emoji: '🎨',
    initial: 'MJ',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'midjourney_basic', name: 'Basic', amount: 40, cycle: 'monthly' }, { id: 'midjourney_standard', name: 'Standard', amount: 80, cycle: 'monthly' }],
      egypt: [{ id: 'midjourney_basic', name: 'Basic', amount: 160, cycle: 'monthly' }, { id: 'midjourney_standard', name: 'Standard', amount: 320, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'perplexity_pro',
    name: 'Perplexity Pro',
    color: '#20B8CD',
    emoji: '🔍',
    initial: 'P',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'perplexity_pro_pro', name: 'Pro', amount: 80, cycle: 'monthly' }],
      egypt: [{ id: 'perplexity_pro_pro', name: 'Pro', amount: 320, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'google_gemini',
    name: 'Google Gemini',
    color: '#4285F4',
    emoji: '✨',
    initial: 'G',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'google_gemini_google_ai_pro', name: 'Google AI Pro', amount: 75, cycle: 'monthly' }],
      egypt: [{ id: 'google_gemini_google_ai_pro', name: 'Google AI Pro', amount: 300, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'grammarly',
    name: 'Grammarly',
    color: '#15C39A',
    emoji: '✍️',
    initial: 'G',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'grammarly_premium', name: 'Premium', amount: 45, cycle: 'monthly' }],
      egypt: [{ id: 'grammarly_premium', name: 'Premium', amount: 180, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catCloudStorage',
    key: 'dropbox',
    name: 'Dropbox',
    color: '#0061FF',
    emoji: '📦',
    initial: 'D',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'dropbox_plus', name: 'Plus', amount: 45, cycle: 'monthly' }, { id: 'dropbox_professional', name: 'Professional', amount: 120, cycle: 'monthly' }],
      egypt: [{ id: 'dropbox_plus', name: 'Plus', amount: 180, cycle: 'monthly' }, { id: 'dropbox_professional', name: 'Professional', amount: 480, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catCloudStorage',
    key: 'microsoft_365',
    name: 'Microsoft 365',
    color: '#D83B01',
    emoji: '📧',
    initial: '365',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'microsoft_365_personal', name: 'Personal', amount: 35, cycle: 'monthly' }, { id: 'microsoft_365_family', name: 'Family', amount: 55, cycle: 'monthly' }],
      egypt: [{ id: 'microsoft_365_personal', name: 'Personal', amount: 140, cycle: 'monthly' }, { id: 'microsoft_365_family', name: 'Family', amount: 220, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catFitness',
    key: 'apple_fitness',
    name: 'Apple Fitness+',
    color: '#69D269',
    emoji: '💪',
    initial: 'AF',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'apple_fitness_monthly', name: 'Monthly', amount: 35, cycle: 'monthly' }],
      egypt: [{ id: 'apple_fitness_monthly', name: 'Monthly', amount: 100, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catFitness',
    key: 'myfitnesspal',
    name: 'MyFitnessPal Premium',
    color: '#0066EE',
    emoji: '🥗',
    initial: 'M',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'myfitnesspal_premium', name: 'Premium', amount: 40, cycle: 'monthly' }],
      egypt: [{ id: 'myfitnesspal_premium', name: 'Premium', amount: 160, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catFitness',
    key: 'strava',
    name: 'Strava',
    color: '#FC4C02',
    emoji: '🚴',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'strava_summit', name: 'Summit', amount: 40, cycle: 'monthly' }],
      egypt: [{ id: 'strava_summit', name: 'Summit', amount: 160, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catCommunication',
    key: 'zoom_pro',
    name: 'Zoom Pro',
    color: '#2D8CFF',
    emoji: '📹',
    initial: 'Z',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'zoom_pro_pro', name: 'Pro', amount: 55, cycle: 'monthly' }],
      egypt: [{ id: 'zoom_pro_pro', name: 'Pro', amount: 220, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catCommunication',
    key: 'slack_pro',
    name: 'Slack Pro',
    color: '#4A154B',
    emoji: '💬',
    initial: 'S',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'slack_pro_pro', name: 'Pro', amount: 8.75, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'slack_pro_business_plus', name: 'Business+', amount: 18, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      egypt: [
        { id: 'slack_pro_pro', name: 'Pro', amount: 8.75, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'slack_pro_business_plus', name: 'Business+', amount: 18, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'slack_pro_pro', name: 'Pro', amount: 8.75, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'slack_pro_business_plus', name: 'Business+', amount: 18, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catReading',
    key: 'kindle_unlimited',
    name: 'Kindle Unlimited',
    color: '#FF9900',
    emoji: '📚',
    initial: 'KU',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'kindle_unlimited_monthly', name: 'Monthly', amount: 35, cycle: 'monthly' }],
      egypt: [{ id: 'kindle_unlimited_monthly', name: 'Monthly', amount: 140, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catReading',
    key: 'audible',
    name: 'Audible',
    color: '#F8991C',
    emoji: '🎧',
    initial: 'A',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'audible_plus', name: 'Plus', amount: 45, cycle: 'monthly' }],
      egypt: [{ id: 'audible_plus', name: 'Plus', amount: 180, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catReading',
    key: 'scribd',
    name: 'Scribd',
    color: '#1E7B85',
    emoji: '📖',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'scribd_monthly', name: 'Monthly', amount: 40, cycle: 'monthly' }],
      egypt: [{ id: 'scribd_monthly', name: 'Monthly', amount: 160, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catVpn',
    key: 'expressvpn',
    name: 'ExpressVPN',
    color: '#DA3940',
    emoji: '🔐',
    initial: 'E',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'expressvpn_monthly', name: 'Monthly', amount: 50, cycle: 'monthly' }],
      egypt: [{ id: 'expressvpn_monthly', name: 'Monthly', amount: 200, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catVpn',
    key: 'surfshark',
    name: 'Surfshark',
    color: '#1B6AEE',
    emoji: '🦈',
    initial: 'S',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'surfshark_monthly', name: 'Monthly', amount: 35, cycle: 'monthly' }],
      egypt: [{ id: 'surfshark_monthly', name: 'Monthly', amount: 140, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'nintendo_switch_online',
    name: 'Nintendo Switch Online',
    color: '#E60012',
    emoji: '🎮',
    initial: 'N',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'nintendo_switch_online_individual', name: 'Individual', amount: 20, cycle: 'monthly' }, { id: 'nintendo_switch_online_family', name: 'Family', amount: 35, cycle: 'monthly' }],
      egypt: [{ id: 'nintendo_switch_online_individual', name: 'Individual', amount: 80, cycle: 'monthly' }, { id: 'nintendo_switch_online_family', name: 'Family', amount: 140, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'ea_play',
    name: 'EA Play',
    color: '#FF4747',
    emoji: '🎯',
    initial: 'EA',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'ea_play_ea_play', name: 'EA Play', amount: 20, cycle: 'monthly' }, { id: 'ea_play_ea_play_pro', name: 'EA Play Pro', amount: 55, cycle: 'monthly' }],
      egypt: [{ id: 'ea_play_ea_play', name: 'EA Play', amount: 80, cycle: 'monthly' }, { id: 'ea_play_ea_play_pro', name: 'EA Play Pro', amount: 220, cycle: 'monthly' }],
    },
  },
  {
    catalogSection: 'catMusic',
    key: 'youtube_music',
    name: 'YouTube Music',
    color: '#FF0000',
    emoji: '🎵',
    initial: 'YM',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ id: 'youtube_music_individual', name: 'Individual', amount: 23, cycle: 'monthly' }, { id: 'youtube_music_family', name: 'Family', amount: 35, cycle: 'monthly' }],
      egypt: [{ id: 'youtube_music_individual', name: 'Individual', amount: 66, cycle: 'monthly' }, { id: 'youtube_music_family', name: 'Family', amount: 100, cycle: 'monthly' }],
    },
  },
]
