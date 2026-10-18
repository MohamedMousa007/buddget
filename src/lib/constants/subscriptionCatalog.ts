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
  // "Zain" alone is a strict prefix of the catalog name "Zain KSA". Safe as an alias
  // because the resolver word-boundary-guards short tokens: `\bzain\b` hits "ZAIN KSA" but
  // not "Zainab". (Mobily/STC already resolve via their catalog names.)
  zain: 'zain_ksa',
  ms365: 'microsoft_365',
  office365: 'microsoft_365',

  // Billing descriptors and spellings from the 2026-10 regional research. Deliberately NOT
  // aliased because the bare word is a different, far bigger merchant: uber, noon, talabat,
  // careem (rides / shopping / orders), orange, etisalat (region-ambiguous), salam, virgin,
  // jahez-as-Arabic ("ready"), plus, pro, club, gym. Those brands match on their full name.
  bein: 'bein_sports',
  beinconnect: 'bein_sports',
  beinmedia: 'bein_sports',
  stcplay: 'stc_tv',
  intigral: 'stc_tv',
  amznprime: 'prime_video',
  bamtech: 'disney_plus',
  disneystreaming: 'disney_plus',
  googleyoutube: 'youtube_premium',
  googleyoutubemusic: 'youtube_music',
  starzon: 'starzplay',
  microsoftxbox: 'xbox_gamepass',
  playstationnetwork: 'playstation_plus',
  sonyinteractiveentertainment: 'playstation_plus',
  psn: 'playstation_plus',
  electronicarts: 'ea_play',
  nordsec: 'nordvpn',
  tefincom: 'nordvpn',
  protonag: 'proton',
  adobe: 'adobe_creative_cloud',
  adobesystems: 'adobe_creative_cloud',
  '1password': 'onepassword',
  agilebits: 'onepassword',
  github: 'github_copilot',
  githubinc: 'github_copilot',
  slack: 'slack_pro',
  slacktechnologies: 'slack_pro',
  zoomus: 'zoom_pro',
  zoomvideocommunications: 'zoom_pro',
  perplexity: 'perplexity_pro',
  perplexityai: 'perplexity_pro',
  anysphere: 'cursor',
  cursorcom: 'cursor',
  googleaipro: 'google_gemini',
  googleaiplus: 'google_gemini',
  googleaiultra: 'google_gemini',
  discord: 'discord_nitro',
  discordcom: 'discord_nitro',
  everand: 'scribd',
  linkedin: 'linkedin_premium',
  linkedinsn: 'linkedin_premium',
  telegram: 'telegram_premium',
  snapchat: 'snapchat_plus',
  snapinc: 'snapchat_plus',
  twitter: 'x_premium',
  xcorp: 'x_premium',
  newyorktimes: 'nytimes',
  mediumcom: 'medium',
  calmcom: 'calm',
  leejam: 'fitness_time',
  noonvip: 'noon_one',
  etihadetisalat: 'mobily',
  mobilyfiber: 'mobily_home',
  mobilyhome: 'mobily_home',
  stchome: 'stc_home',
  salamtelecom: 'salam_ksa',
  virginmobilesaudi: 'virgin_ksa',
  lebara: 'lebara_ksa',
  dutelecom: 'du_mobile',
  emiratesintegratedtelecom: 'du_mobile',
  eitc: 'du_mobile',
  etisalatelife: 'etisalat_uae',
  elife: 'etisalat_uae',
  etisalatmisr: 'etisalat_eg',
  eandegypt: 'etisalat_eg',
  telecomegypt: 'we_internet',
  weegypt: 'we_internet',
  vodafone: 'vodafone_eg',
  myorange: 'orange_eg',
}

/**
 * Arabic spellings of brand names, as they appear in Arabic bank SMS. Phrases are stored
 * normalised (see {@link normalizeArabic}) and matched on whole-word boundaries: Arabic has
 * no case or word-boundary anchor, and a bare substring would let "شاهد" (watch / witness) hit any sentence.
 */
const ARABIC_BRAND_ALIASES: Record<string, string> = {
  'نتفليكس': 'netflix',
  'نتفلكس': 'netflix',
  'نيتفليكس': 'netflix',
  'سبوتيفاي': 'spotify',
  'شاهد': 'shahid_vip',
  'انغامي': 'anghami',
  'ديزني': 'disney_plus',
  'ديزني بلس': 'disney_plus',
  'يوتيوب': 'youtube_premium',
  'ايكلاود': 'icloud',
  'امازون برايم': 'prime_video',
  'تشات جي بي تي': 'chatgpt_plus',
  // Never a bare "طلبات" / "اورنج" / "زين" / "جاهز": they are ordinary words and bigger merchants.
  'واتش ات': 'watchit',
  'ستارزبلاي': 'starzplay',
  'ستارز بلاي': 'starzplay',
  'او اس ان': 'osn_plus',
  'ابل ميوزك': 'apple_music',
  'ابل تي في': 'apple_tv_plus',
  'يوتيوب ميوزك': 'youtube_music',
  'جوجل ون': 'google_one',
  'بي ان سبورتس': 'bein_sports',
  'اوبن ايه اي': 'chatgpt_plus',
  'انثروبيك': 'claude_pro',
  'بلاي ستيشن': 'playstation_plus',
  'اكس بوكس': 'xbox_gamepass',
  'ويياك': 'weyyak',
  'كرانشي رول': 'crunchyroll',
  'كانفا': 'canva',
  'كورسيرا': 'coursera',
  'دولينجو': 'duolingo',
  'ديسكورد': 'discord_nitro',
  'تيليجرام': 'telegram_premium',
  'سناب شات': 'snapchat_plus',
  'ستارلينك': 'starlink',
  'ستوريتل': 'storytel',
  'ديزر': 'deezer',
  'لينكد ان': 'linkedin_premium',
  'مايكروسوفت 365': 'microsoft_365',
  'طلبات برو': 'talabat_pro',
  'نون ون': 'noon_one',
  'كريم بلس': 'careem_plus',
  'اوبر ون': 'uber_one',
  'هنقرستيشن': 'hungerstation',
  'فودافون': 'vodafone_eg',
  'اورنج مصر': 'orange_eg',
  'اتصالات مصر': 'etisalat_eg',
  'اتصالات الامارات': 'etisalat_uae',
  'المصرية للاتصالات': 'we_internet',
  'موبايلي': 'mobily',
  'زين السعودية': 'zain_ksa',
  'اس تي سي': 'stc',
  'اس تي سي بلاي': 'stc_tv',
  'سلام موبايل': 'salam_ksa',
  'ليبارا': 'lebara_ksa',
  'دو للاتصالات': 'du_mobile',
  'فتنس تايم': 'fitness_time',
  'فيتنس تايم': 'fitness_time',
  'ليجام': 'fitness_time',
  'جولدز جيم': 'golds_gym',
}

/** Strips diacritics/tatweel and folds alef/yaa/taa-marbuta variants so spellings compare equal. */
function normalizeArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A0-9a-z]+/gi, ' ')
    .trim()
}

function resolveArabicBrand(merchant: string): string | null {
  if (!/[\u0600-\u06FF]/.test(merchant)) return null
  const padded = ` ${normalizeArabic(merchant)} `
  // Longest phrase wins, so "يوتيوب ميوزك" is YouTube Music, not YouTube Premium.
  let best: { key: string; length: number } | null = null
  for (const [phrase, key] of Object.entries(ARABIC_BRAND_ALIASES)) {
    const normalized = normalizeArabic(phrase)
    if (padded.includes(` ${normalized} `) && (!best || normalized.length > best.length)) {
      best = { key, length: normalized.length }
    }
  }
  return best?.key ?? null
}

/**
 * Catalog entries that are a generic category, not a merchant: a gym's name is not "Gym
 * Membership", yet the word alone would resolve any gym purchase to it. Likewise "Calm" and
 * "Medium" are ordinary words ("Calm Cafe"). They stay pickable and match on an exact name or
 * a dedicated alias, but are excluded from the containment pass.
 */
const GENERIC_BRAND_KEYS: ReadonlySet<string> = new Set(['gym', 'calm', 'medium'])

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
/** Wallet and payment-rail merchants share a telecom's name ("Vodafone Cash") but are never its subscription. */
const WALLET_OR_RAIL = /\b(?:vodafone|orange|etisalat|e&|we)\s*cash\b|\b(?:wallet|instapay|fawry|meeza)\b|كاش|محفظ|فوري/i

export function resolveBrandKeyFromMerchant(merchant: string | null | undefined): string | null {
  if (!merchant) return null
  if (WALLET_OR_RAIL.test(merchant)) return null
  const norm = normalizeBrandToken(merchant)
  if (!norm) return resolveArabicBrand(merchant)

  // hasOwn: a merchant called "constructor" must not resolve to Object.prototype.constructor.
  if (Object.prototype.hasOwnProperty.call(MERCHANT_BRAND_ALIASES, norm)) return MERCHANT_BRAND_ALIASES[norm]
  for (const b of SUBSCRIPTION_CATALOG) {
    if (normalizeBrandToken(b.key) === norm || normalizeBrandToken(b.name) === norm) return b.key
  }

  const candidates: { token: string; key: string }[] = [
    ...Object.entries(MERCHANT_BRAND_ALIASES).map(([token, key]) => ({ token, key })),
    ...SUBSCRIPTION_CATALOG.filter((b) => !GENERIC_BRAND_KEYS.has(b.key)).flatMap((b) => [
      { token: normalizeBrandToken(b.key), key: b.key },
      { token: normalizeBrandToken(b.name), key: b.key },
    ]),
  ]
    .filter((c) => c.token)
    .sort((a, b) => b.token.length - a.token.length)

  for (const { token, key } of candidates) {
    if (merchantMentions(merchant, norm, token)) return key
  }
  return resolveArabicBrand(merchant)
}

export const SUBSCRIPTION_CATALOG: SubscriptionBrand[] = [
  {
    catalogSection: 'catStreaming',
    key: 'netflix',
    name: 'Netflix',
    color: '#12B0A0',
    emoji: '🎬',
    initial: 'N',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'netflix_basic', name: 'Basic', amount: 35, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'netflix_standard', name: 'Standard', amount: 49, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'netflix_premium', name: 'Premium', amount: 71, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'netflix_basic', name: 'Basic', amount: 110, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'netflix_standard', name: 'Standard', amount: 190, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'netflix_premium', name: 'Premium', amount: 270, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'netflix_basic', name: 'Basic', amount: 35, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'netflix_standard', name: 'Standard', amount: 49, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'netflix_premium', name: 'Premium', amount: 71, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'shahid_vip_vip', name: 'VIP', amount: 44.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_bigtime', name: 'VIP BigTime', amount: 54.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_sports', name: 'VIP Sports', amount: 69.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_ultimate', name: 'Ultimate', amount: 89.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_yearly', name: 'VIP (yearly)', amount: 449.99, cycle: 'yearly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'shahid_vip_vip_mobile', name: 'VIP Mobile', amount: 52.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip', name: 'VIP', amount: 159.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_bigtime', name: 'VIP BigTime', amount: 289.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_sports', name: 'VIP Sports', amount: 439.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_ultimate', name: 'Ultimate', amount: 639.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'shahid_vip_vip', name: 'VIP', amount: 44.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_bigtime', name: 'VIP BigTime', amount: 54.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_sports', name: 'VIP Sports', amount: 69.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_ultimate', name: 'Ultimate', amount: 89.99, cycle: 'monthly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
        { id: 'shahid_vip_vip_yearly', name: 'VIP (yearly)', amount: 449.99, cycle: 'yearly', description: 'Billed via App Store', verifiedAt: '2026-10-17' },
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
      egypt: [
        { id: 'watchit_basic', name: 'Basic', amount: 19.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'watchit_premium', name: 'Premium', amount: 99.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'watchit_basic_yearly', name: 'Basic (yearly)', amount: 199.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'watchit_premium_yearly', name: 'Premium (yearly)', amount: 999.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'watchit_basic_carrier', name: 'Basic (carrier billing)', amount: 110, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'watchit_premium_carrier', name: 'Premium (carrier billing)', amount: 140, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'watchit_basic_carrier_yearly', name: 'Basic (carrier billing, yearly)', amount: 1320, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'watchit_premium_carrier_yearly', name: 'Premium (carrier billing, yearly)', amount: 1680, cycle: 'yearly', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'disney_plus_monthly', name: 'Monthly', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'disney_plus_yearly', name: 'Yearly', amount: 449.9, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'disney_plus_monthly', name: 'Monthly', amount: 79.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'disney_plus_monthly', name: 'Monthly', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'disney_plus_yearly', name: 'Yearly', amount: 449.9, cycle: 'yearly', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'egypt', 'saudi'],
    // Egypt: the website bills in USD; carrier billing (Etisalat/Orange/Vodafone) is EGP. UAE/KSA are App Store prices.
    plans: {
      uae: [
        { id: 'osn_plus_standard', name: 'Standard', amount: 48.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_premium', name: 'Premium', amount: 64.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_ads', name: 'Standard with ads', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_mobile', name: 'Mobile', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_yearly', name: 'Standard (yearly)', amount: 489.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_premium_yearly', name: 'Premium (yearly)', amount: 649.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'osn_plus_premium_web', name: 'Premium (web)', amount: 4.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_web', name: 'Standard (web)', amount: 3.49, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_ads_web', name: 'Standard with ads (web)', amount: 1.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_premium_web_yearly', name: 'Premium (web, yearly)', amount: 49.92, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_web_yearly', name: 'Standard (web, yearly)', amount: 34.92, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_carrier', name: 'Standard (carrier billing)', amount: 140, cycle: 'monthly', description: 'Etisalat / Orange / Vodafone billing', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_ads_carrier', name: 'Standard with ads (carrier billing)', amount: 90, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'osn_plus_standard', name: 'Standard', amount: 48.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_premium', name: 'Premium', amount: 69.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_ads', name: 'Standard with ads', amount: 34.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_mobile', name: 'Mobile', amount: 34.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_standard_yearly', name: 'Standard (yearly)', amount: 489.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'osn_plus_premium_yearly', name: 'Premium (yearly)', amount: 699.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'youtube_premium_individual', name: 'Individual', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'youtube_premium_family', name: 'Family', amount: 57.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'youtube_premium_individual', name: 'Individual', amount: 87.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'youtube_premium_family', name: 'Family', amount: 159.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'youtube_premium_student', name: 'Student', amount: 52.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'youtube_premium_lite', name: 'Premium Lite', amount: 52.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catMusic',
    key: 'spotify',
    name: 'Spotify',
    color: '#37C368',
    emoji: '🎵',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'spotify_standard', name: 'Standard', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_platinum', name: 'Platinum', amount: 59.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'spotify_individual', name: 'Individual', amount: 79, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_duo', name: 'Duo', amount: 109, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_family', name: 'Family', amount: 139, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_student', name: 'Student', amount: 39, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'spotify_standard', name: 'Standard', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_platinum', name: 'Platinum', amount: 59.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'spotify_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
        { id: 'apple_music_individual', name: 'Individual', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'apple_music_family', name: 'Family', amount: 39.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'apple_music_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'apple_music_individual', name: 'Individual', amount: 79.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'apple_music_family', name: 'Family', amount: 109.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'apple_music_student', name: 'Student', amount: 34.99, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
      saudi: [
        { id: 'apple_music_individual', name: 'Individual', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'apple_music_family', name: 'Family', amount: 39.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'apple_music_student', name: 'Student', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catStreaming',
    key: 'apple_tv_plus',
    name: 'Apple TV',
    color: '#000000',
    emoji: '📺',
    initial: 'tv+',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'prime_video',
    name: 'Amazon Prime',
    color: '#00A8E1',
    emoji: '📦',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'prime_video_monthly', name: 'Monthly', amount: 16, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'prime_video_yearly', name: 'Yearly', amount: 140, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'prime_video_monthly', name: 'Monthly', amount: 29, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'prime_video_yearly', name: 'Yearly', amount: 249, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'prime_video_monthly', name: 'Monthly', amount: 16, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'prime_video_yearly', name: 'Yearly', amount: 140, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
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
        { id: 'icloud_50gb', name: '50GB', amount: 3.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_200gb', name: '200GB', amount: 11.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_2tb', name: '2TB', amount: 39.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_6tb', name: '6TB', amount: 119.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_12tb', name: '12TB', amount: 239.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'icloud_50gb', name: '50GB', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_200gb', name: '200GB', amount: 179.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_2tb', name: '2TB', amount: 599.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_6tb', name: '6TB', amount: 1799.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_12tb', name: '12TB', amount: 3599.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'icloud_50gb', name: '50GB', amount: 3.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_200gb', name: '200GB', amount: 12.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_2tb', name: '2TB', amount: 44.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_6tb', name: '6TB', amount: 129.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'icloud_12tb', name: '12TB', amount: 269.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'google_one_ai_plus', name: 'Google AI Plus', amount: 18.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'google_one_ai_pro', name: 'Google AI Pro', amount: 76.99, cycle: 'monthly', description: '2 TB', verifiedAt: '2026-10-17' },
        { id: 'google_one_ai_ultra', name: 'Google AI Ultra', amount: 369.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'google_one_100_gb', name: '100 GB', amount: 94.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'google_one_ai_plus', name: 'Google AI Plus', amount: 449.99, cycle: 'monthly', description: '2 TB', verifiedAt: '2026-10-17' },
        { id: 'google_one_ai_pro', name: 'Google AI Pro', amount: 939.99, cycle: 'monthly', description: '5 TB', verifiedAt: '2026-10-17' },
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
    // Egypt bills in EGP. UAE/KSA: the USD web plan is kept; the App Store plans are Apple-billed local prices.
    plans: {
      uae: [
        { id: 'chatgpt_plus_plus', name: 'Plus', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'chatgpt_plus_plus_appstore', name: 'Plus (App Store)', amount: 79.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'chatgpt_plus_go', name: 'Go', amount: 29.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'chatgpt_plus_plus', name: 'Plus', amount: 999.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'chatgpt_plus_go', name: 'Go', amount: 220, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'chatgpt_plus_pro', name: 'Pro', amount: 5400, cycle: 'monthly', description: 'From 5,400 EGP', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'chatgpt_plus_plus', name: 'Plus', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'chatgpt_plus_plus_appstore', name: 'Plus (App Store)', amount: 89.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'chatgpt_plus_go', name: 'Go', amount: 35, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
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
    // Web plans are USD everywhere. The 'App Store' plans are what Apple bills in AED/SAR (VAT included).
    plans: {
      uae: [
        { id: 'claude_pro_pro', name: 'Pro', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_pro_annual', name: 'Pro (annual)', amount: 17, currency: 'USD', cycle: 'monthly', description: 'Billed yearly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_max', name: 'Max (from)', amount: 100, currency: 'USD', cycle: 'monthly', description: 'From $100 / month', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_pro_appstore', name: 'Pro (App Store)', amount: 79.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_pro_appstore_yearly', name: 'Pro (App Store, yearly)', amount: 799.99, cycle: 'yearly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_max_5x_appstore', name: 'Max 5x (App Store)', amount: 499.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_max_20x_appstore', name: 'Max 20x (App Store)', amount: 999.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'claude_pro_pro', name: 'Pro', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_pro_annual', name: 'Pro (annual)', amount: 17, currency: 'USD', cycle: 'monthly', description: 'Billed yearly', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_max', name: 'Max (from)', amount: 100, currency: 'USD', cycle: 'monthly', description: 'From $100 / month', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'claude_pro_pro', name: 'Pro', amount: 20, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_pro_annual', name: 'Pro (annual)', amount: 17, currency: 'USD', cycle: 'monthly', description: 'Billed yearly', verifiedAt: '2026-07-17' },
        { id: 'claude_pro_max', name: 'Max (from)', amount: 100, currency: 'USD', cycle: 'monthly', description: 'From $100 / month', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_pro_appstore', name: 'Pro (App Store)', amount: 89.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_pro_appstore_yearly', name: 'Pro (App Store, yearly)', amount: 999.99, cycle: 'yearly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_max_5x_appstore', name: 'Max 5x (App Store)', amount: 499.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
        { id: 'claude_pro_max_20x_appstore', name: 'Max 20x (App Store)', amount: 999.99, cycle: 'monthly', description: 'Billed by Apple in local currency, VAT included', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'gym_monthly', name: 'Monthly', amount: 200, cycle: 'monthly', description: 'Adjust to your gym price' },
      ],
      egypt: [
        { id: 'gym_monthly', name: 'Monthly', amount: 500, cycle: 'monthly', description: 'Adjust to your gym price' },
      ],
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
    availability: ['uae', 'saudi'],
    // Egypt has NO PlayStation Store locale: store.playstation.com/en-eg 302s to en-us and
    // playstation.com/en-eg/ps-plus 404s. UAE and KSA bill in their LOCAL store currency
    // (AED / SAR, 1/3/12-month SKUs), not USD; every SKU is recurring with no intro price.
    plans: {
      uae: [
        { id: 'playstation_plus_essential', name: 'Essential', amount: 32.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_essential_quarterly', name: 'Essential (3 months)', amount: 84.99, cycle: 'quarterly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_essential_yearly', name: 'Essential (12 months)', amount: 239.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_extra', name: 'Extra', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_extra_quarterly', name: 'Extra (3 months)', amount: 139.99, cycle: 'quarterly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_extra_yearly', name: 'Extra (12 months)', amount: 396.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_deluxe', name: 'Deluxe', amount: 58.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_deluxe_quarterly', name: 'Deluxe (3 months)', amount: 161.99, cycle: 'quarterly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_deluxe_yearly', name: 'Deluxe (12 months)', amount: 459.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'playstation_plus_essential', name: 'Essential', amount: 33.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_essential_quarterly', name: 'Essential (3 months)', amount: 85.99, cycle: 'quarterly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_essential_yearly', name: 'Essential (12 months)', amount: 243.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_extra', name: 'Extra', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_extra_quarterly', name: 'Extra (3 months)', amount: 141.99, cycle: 'quarterly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_extra_yearly', name: 'Extra (12 months)', amount: 399.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_deluxe', name: 'Deluxe', amount: 59.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_deluxe_quarterly', name: 'Deluxe (3 months)', amount: 164.99, cycle: 'quarterly', verifiedAt: '2026-10-17' },
        { id: 'playstation_plus_deluxe_yearly', name: 'Deluxe (12 months)', amount: 469.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
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
    availability: ['uae', 'saudi', 'egypt'],
    plans: {},
  },
  {
    catalogSection: 'catVpn',
    key: 'nordvpn',
    name: 'NordVPN',
    color: '#4687FF',
    emoji: '🔒',
    initial: 'N',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    // Only the 27-month deal is verified. These are billed upfront; the amount is the monthly equivalent.
    plans: {
      uae: [
        { id: 'nordvpn_basic', name: 'Basic (27 months)', amount: 3.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
        { id: 'nordvpn_complete', name: 'Complete (27 months)', amount: 4.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
        { id: 'nordvpn_complete_max', name: 'Complete Max (27 months)', amount: 6.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'nordvpn_basic', name: 'Basic (27 months)', amount: 3.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
        { id: 'nordvpn_complete', name: 'Complete (27 months)', amount: 4.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
        { id: 'nordvpn_complete_max', name: 'Complete Max (27 months)', amount: 6.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'nordvpn_basic', name: 'Basic (27 months)', amount: 3.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
        { id: 'nordvpn_complete', name: 'Complete (27 months)', amount: 4.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
        { id: 'nordvpn_complete_max', name: 'Complete Max (27 months)', amount: 6.49, currency: 'USD', cycle: 'monthly', description: 'Billed upfront for 27 months; this is the monthly equivalent', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'we_internet',
    name: 'WE (Telecom Egypt)',
    color: '#7B2D8E',
    emoji: '🌐',
    initial: 'WE',
    defaultCategory: 'Other',
    availability: ['egypt'],
    plans: {
      egypt: [
        { id: 'we_internet_space_50', name: 'Space Super 30 Mbps, 50 GB', amount: 150, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_150', name: 'Space Super 30 Mbps, 150 GB', amount: 260, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_200', name: 'Space Super 30 Mbps, 200 GB', amount: 330, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_250', name: 'Space Super 30 Mbps, 250 GB', amount: 395, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_300', name: 'Space Super 30 Mbps, 300 GB', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_400', name: 'Space Super 30 Mbps, 400 GB', amount: 580, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_500', name: 'Space Super 30 Mbps, 500 GB', amount: 660, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_750', name: 'Space Super 30 Mbps, 750 GB', amount: 925, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_space_1500', name: 'Space Super 30 Mbps, 1500 GB', amount: 1650, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_gold_300', name: 'Gold 300 (5.5 GB, 1200 min)', amount: 300, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_gold_600', name: 'Gold 600 (20 GB, 3700 min)', amount: 600, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_gold_890', name: 'Gold 890 (30 GB, 6000 min)', amount: 890, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_gold_1200', name: 'Gold 1200 (65 GB, 8000 min)', amount: 1200, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_gold_1500', name: 'Gold 1500 (70 GB, 9000 min)', amount: 1500, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'we_internet_gold_2300', name: 'Gold 2300 (130 GB, 10000 min)', amount: 2300, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
      egypt: [
        { id: 'vodafone_eg_flex_52', name: 'Flex 52', amount: 52, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_flex_80', name: 'Flex 80', amount: 80, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_flex_115', name: 'Flex 115', amount: 115, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_flex_175', name: 'Flex 175', amount: 175, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_flex_345', name: 'Flex 345', amount: 345, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_red_essential', name: 'RED Essential+ (16 GB, 3500 min)', amount: 575, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_red_advance', name: 'RED Advance+ (32 GB, 6000 min)', amount: 980, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_red_prime', name: 'RED Prime+ (50 GB, 8000 min)', amount: 1380, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_red_elite', name: 'RED Elite+ (85 GB, 10000 min)', amount: 2000, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_red_exclusive', name: 'RED Exclusive (200 GB, 11000 min)', amount: 3450, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_home_wireless_40', name: 'Home Wireless 40 GB', amount: 290, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_home_wireless_135', name: 'Home Wireless 135 GB', amount: 520, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_home_wireless_250', name: 'Home Wireless 250 GB', amount: 830, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'vodafone_eg_home_wireless_400', name: 'Home Wireless 400 GB', amount: 1270, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
      egypt: [
        { id: 'orange_eg_premier_lite', name: 'PREMIER Lite (15 GB, 2500 min)', amount: 520, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_premier_plus', name: 'PREMIER Plus (20 GB, 3500 min)', amount: 690, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_premier_select', name: 'PREMIER Select (25 GB, 5000 min)', amount: 860, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_premier_ultra', name: 'PREMIER Ultra (40 GB, 7000 min)', amount: 1200, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_premier_platinum', name: 'PREMIER Platinum (70 GB, 10000 min)', amount: 1725, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_freemax_52', name: 'FREEmax 52', amount: 52, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_freemax_80', name: 'FREEmax 80', amount: 80, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_freemax_115', name: 'FREEmax 115', amount: 115, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_freemax_175', name: 'FREEmax 175', amount: 175, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_freemax_230', name: 'FREEmax 230', amount: 230, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_freemax_345', name: 'FREEmax 345', amount: 345, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_dsl_30', name: 'Home DSL 30 Mbps (from, 50 GB)', amount: 150, cycle: 'monthly', description: 'Starting price', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_dsl_70', name: 'Home DSL 70 Mbps (from)', amount: 590, cycle: 'monthly', description: 'Starting price', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_dsl_100', name: 'Home DSL 100 Mbps (from)', amount: 880, cycle: 'monthly', description: 'Starting price', verifiedAt: '2026-10-17' },
        { id: 'orange_eg_dsl_200', name: 'Home DSL 200 Mbps (from)', amount: 2350, cycle: 'monthly', description: 'Starting price', verifiedAt: '2026-10-17' },
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
      egypt: [
        { id: 'etisalat_eg_emerald_460', name: 'Emerald 460 (13 GB, 2500 min)', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_emerald_820', name: 'Emerald 820 (27 GB, 4500 min)', amount: 820, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_emerald_1170', name: 'Emerald 1170 (43 GB, 6500 min)', amount: 1170, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_emerald_1725', name: 'Emerald 1725 (70 GB, 10000 min)', amount: 1725, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_emerald_3450', name: 'Emerald 3450 (200 GB, 12000 min)', amount: 3450, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_hekaya_52', name: 'Hekaya mixat (from)', amount: 52, cycle: 'monthly', description: 'Starting price', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_dsl_50', name: 'eHome DSL 30 Mbps, 50 GB', amount: 150, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_dsl_150', name: 'eHome DSL 30 Mbps, 150 GB', amount: 260, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_dsl_200', name: 'eHome DSL 30 Mbps, 200 GB', amount: 330, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_dsl_300', name: 'eHome DSL 30 Mbps, 300 GB', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'etisalat_eg_dsl_750', name: 'eHome DSL 30 Mbps, 750 GB', amount: 925, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
    plans: {},
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
    // eLife home fibre. e& lists these ex-VAT; amounts here are the listed price + 5% VAT, which is what the bill shows.
    // Emirati-national mobile plans are deliberately not listed (eligibility-gated).
    plans: {
      uae: [
        { id: 'etisalat_uae_elife_lite_12', name: 'eLife Lite 12', amount: 313.95, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
        { id: 'etisalat_uae_elife_lite_25', name: 'eLife Lite 25', amount: 418.95, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
        { id: 'etisalat_uae_elife_lite_50', name: 'eLife Lite 50', amount: 628.95, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
        { id: 'etisalat_uae_elife_lite_100', name: 'eLife Lite 100', amount: 786.45, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
        { id: 'etisalat_uae_elife_unlimited_starter', name: 'eLife Unlimited Starter', amount: 408.45, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
        { id: 'etisalat_uae_elife_ultra_fusion', name: 'eLife Ultra Fusion', amount: 855.75, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
        { id: 'etisalat_uae_elife_family', name: 'eLife Family Home Plan', amount: 376.95, cycle: 'monthly', description: 'Listed price plus 5% VAT', verifiedAt: '2026-10-17' },
      ],
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
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'stc',
    name: 'stc',
    color: '#4F008C',
    emoji: '📱',
    initial: 'S',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    // Mofawtar postpaid, SAR incl. 15% VAT. Verified from stc's own store, not blogs: every blog said MAX = 575; it is 920.
    plans: {
      saudi: [
        { id: 'stc_mofawtar_basic_plus', name: 'Mofawtar Basic Plus', amount: 90, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_mofawtar_2', name: 'Mofawtar 2 Lite', amount: 145, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_mofawtar_2_plus', name: 'Mofawtar 2 Extra', amount: 180, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_mofawtar_3_plus', name: 'Mofawtar 3 Plus', amount: 264.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_mofawtar_flex', name: 'Mofawtar Flex', amount: 370, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_mofawtar_4', name: 'Mofawtar 4 Extra', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_mofawtar_max', name: 'Mofawtar MAX', amount: 920, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'mobily',
    name: 'Mobily',
    color: '#00A651',
    emoji: '📱',
    initial: 'M',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    // SAR incl. 15% VAT. NOTE: the plan NAME is the pre-VAT figure, the billed amount is +15% (65 -> 74.75).
    // Postpaid 65/100/XStream Plus/Max could not be re-read on 2026-10-17: they keep their 2026-07-17 date.
    plans: {
      saudi: [
        { id: 'mobily_postpaid_65', name: 'Postpaid 65', amount: 74.75, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'mobily_postpaid_100', name: 'Postpaid 100', amount: 115, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'mobily_postpaid_150', name: 'Postpaid 150', amount: 172.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_postpaid_200', name: 'Postpaid 200', amount: 230, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_postpaid_300', name: 'Postpaid 300', amount: 345, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_postpaid_400', name: 'Postpaid 400', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_postpaid_xstream', name: 'Postpaid XStream', amount: 255, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_postpaid_xstream_plus', name: 'Postpaid XStream Plus', amount: 370, cycle: 'monthly', verifiedAt: '2026-07-17' },
        { id: 'mobily_postpaid_xstream_max', name: 'Postpaid XStream Max', amount: 570, cycle: 'monthly', verifiedAt: '2026-07-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'zain_ksa',
    name: 'Zain KSA',
    color: '#7B2D8E',
    emoji: '📱',
    initial: 'Z',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    // SAR incl. 15% VAT. Unlike Mobily, Zain's plan name equals the billed price.
    plans: {
      saudi: [
        { id: 'zain_ksa_postpaid_75', name: 'Postpaid 75', amount: 75, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'zain_ksa_postpaid_120', name: 'Postpaid 120', amount: 120, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'zain_ksa_postpaid_180', name: 'Postpaid 180', amount: 180, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'zain_ksa_postpaid_250', name: 'Postpaid 250', amount: 250, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'zain_ksa_postpaid_420', name: 'Postpaid 420', amount: 420, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'zain_ksa_postpaid_650', name: 'Postpaid 650', amount: 650, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'zain_ksa_black', name: 'Black', amount: 1000, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
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
    availability: [],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'crunchyroll',
    name: 'Crunchyroll',
    color: '#F47521',
    emoji: '🍥',
    initial: 'C',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'crunchyroll_fan', name: 'Fan', amount: 21.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'crunchyroll_mega_fan', name: 'Mega Fan', amount: 25.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'crunchyroll_ultimate_fan', name: 'Ultimate Fan', amount: 57.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'crunchyroll_mega_fan_yearly', name: 'Mega Fan (yearly)', amount: 229.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'crunchyroll_fan', name: 'Fan', amount: 19.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'crunchyroll_mega_fan', name: 'Mega Fan', amount: 23.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'crunchyroll_ultimate_fan', name: 'Ultimate Fan', amount: 59.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'crunchyroll_mega_fan_yearly', name: 'Mega Fan (yearly)', amount: 209.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
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
    availability: [],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'paramount_plus',
    name: 'Paramount+',
    color: '#0064FF',
    emoji: '▶️',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: [],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'peacock',
    name: 'Peacock',
    color: '#000000',
    emoji: '🦚',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: [],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'mubi',
    name: 'Mubi',
    color: '#0D0D0D',
    emoji: '🎞️',
    initial: 'M',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'starzplay',
    name: 'Starzplay',
    color: '#000000',
    emoji: '⭐',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'starzplay_max', name: 'Max', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'starzplay_sports', name: 'Sports', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'starzplay_max', name: 'Max', amount: 49.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'starzplay_sports', name: 'Sports', amount: 44.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'anghami_plus', name: 'Plus', amount: 22.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'anghami_student', name: 'Student', amount: 11.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'anghami_family', name: 'Family', amount: 34.49, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'anghami_plus', name: 'Plus', amount: 69.99, cycle: 'monthly', description: 'App Store / Google Play', verifiedAt: '2026-10-17' },
        { id: 'anghami_plus_carrier', name: 'Plus (carrier billing)', amount: 65, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'anghami_plus_web', name: 'Plus (website)', amount: 2.5, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'anghami_plus', name: 'Plus', amount: 22.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'anghami_student', name: 'Student', amount: 11.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
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
      egypt: [
        { id: 'tod_entertainment', name: 'Entertainment', amount: 140, cycle: 'monthly' },
        { id: 'tod_sports', name: 'Sports', amount: 220, cycle: 'monthly' },
      ],
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
    availability: ['saudi'],
    plans: {},
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
      uae: [
        { id: 'yango_play_monthly', name: 'Monthly', amount: 25, cycle: 'monthly' },
      ],
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'viu_premium', name: 'Premium', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'viu_premium_yearly', name: 'Premium (yearly)', amount: 239.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'viu_premium', name: 'Premium', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'viu_premium_yearly', name: 'Premium (yearly)', amount: 239.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'weyyak_monthly', name: 'Monthly', amount: 18.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'weyyak_weekly', name: 'Weekly', amount: 5.99, cycle: 'weekly', verifiedAt: '2026-10-17' },
        { id: 'weyyak_yearly', name: 'Yearly', amount: 149.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'weyyak_monthly', name: 'Monthly', amount: 18.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'weyyak_weekly', name: 'Weekly', amount: 5.99, cycle: 'weekly', verifiedAt: '2026-10-17' },
        { id: 'weyyak_yearly', name: 'Yearly', amount: 149.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
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
    plans: {},
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
    plans: {},
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'perplexity_pro',
    name: 'Perplexity Pro',
    color: '#20B8CD',
    emoji: '🔍',
    initial: 'P',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'perplexity_pro_pro', name: 'Pro', amount: 79.99, cycle: 'monthly', description: 'App Store price; the website bills in USD', verifiedAt: '2026-10-17' },
        { id: 'perplexity_pro_pro_yearly', name: 'Pro (yearly)', amount: 799.99, cycle: 'yearly', description: 'App Store price; the website bills in USD', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'perplexity_pro_pro', name: 'Pro', amount: 89.99, cycle: 'monthly', description: 'App Store price; the website bills in USD', verifiedAt: '2026-10-17' },
        { id: 'perplexity_pro_pro_yearly', name: 'Pro (yearly)', amount: 899.99, cycle: 'yearly', description: 'App Store price; the website bills in USD', verifiedAt: '2026-10-17' },
      ],
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'google_gemini_google_ai_pro', name: 'Google AI Pro', amount: 76.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'google_gemini_google_ai_plus', name: 'Google AI Plus', amount: 18.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'google_gemini_google_ai_pro', name: 'Google AI Pro', amount: 939.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'google_gemini_google_ai_plus', name: 'Google AI Plus', amount: 449.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
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
    plans: {},
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
    plans: {},
  },
  {
    catalogSection: 'catCloudStorage',
    key: 'microsoft_365',
    name: 'Microsoft 365',
    color: '#D83B01',
    emoji: '📧',
    initial: '365',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {
      uae: [
        { id: 'microsoft_365_personal', name: 'Personal', amount: 35, cycle: 'monthly' },
        { id: 'microsoft_365_family', name: 'Family', amount: 55, cycle: 'monthly' },
      ],
      egypt: [
        { id: 'microsoft_365_personal', name: 'Personal', amount: 239, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'microsoft_365_family', name: 'Family', amount: 289, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'microsoft_365_personal_yearly', name: 'Personal (yearly)', amount: 2399, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'microsoft_365_family_yearly', name: 'Family (yearly)', amount: 2899, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'microsoft_365_personal', name: 'Personal', amount: 42.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'microsoft_365_family', name: 'Family', amount: 55.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'microsoft_365_personal_yearly', name: 'Personal (yearly)', amount: 429.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'microsoft_365_family_yearly', name: 'Family (yearly)', amount: 559.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
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
    plans: {},
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
    plans: {},
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
      uae: [
        { id: 'strava_summit', name: 'Summit', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'strava_summit_yearly', name: 'Summit (yearly)', amount: 229.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
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
    plans: {},
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
      uae: [
        { id: 'kindle_unlimited_monthly', name: 'Monthly', amount: 35, cycle: 'monthly' },
      ],
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
    plans: {},
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
      uae: [
        { id: 'scribd_monthly', name: 'Monthly', amount: 40, cycle: 'monthly' },
      ],
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
    availability: ['uae', 'egypt', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catVpn',
    key: 'surfshark',
    name: 'Surfshark',
    color: '#1B6AEE',
    emoji: '🦈',
    initial: 'S',
    defaultCategory: 'Other',
    availability: ['uae', 'egypt', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catGaming',
    key: 'nintendo_switch_online',
    name: 'Nintendo Switch Online',
    color: '#E60012',
    emoji: '🎮',
    initial: 'N',
    defaultCategory: 'Enjoyment',
    availability: [],
    plans: {},
  },
  {
    catalogSection: 'catGaming',
    key: 'ea_play',
    name: 'EA Play',
    color: '#FF4747',
    emoji: '🎯',
    initial: 'EA',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'saudi'],
    plans: {},
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
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'bein_sports',
    name: 'beIN Sports',
    color: '#5B2D8E',
    emoji: '⚽',
    initial: 'beIN',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae'],
    plans: {},
  },
  {
    catalogSection: 'catStreaming',
    key: 'stc_tv',
    name: 'stc tv',
    color: '#4F008C',
    emoji: '📺',
    initial: 'tv',
    defaultCategory: 'Enjoyment',
    availability: ['saudi'],
    plans: {
      saudi: [
        { id: 'stc_tv_monthly', name: 'Monthly', amount: 32.99, cycle: 'monthly', description: 'App Store price', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'apple_arcade',
    name: 'Apple Arcade',
    color: '#FF375F',
    emoji: '🕹️',
    initial: 'AA',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catMusic',
    key: 'deezer',
    name: 'Deezer',
    color: '#A238FF',
    emoji: '🎧',
    initial: 'D',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'deezer_premium', name: 'Premium', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'deezer_family', name: 'Family', amount: 40.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'deezer_premium', name: 'Premium', amount: 27.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'deezer_family', name: 'Family', amount: 36.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catReading',
    key: 'storytel',
    name: 'Storytel',
    color: '#FF5A1F',
    emoji: '📖',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'storytel_unlimited', name: 'Unlimited', amount: 9.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'storytel_unlimited_yearly', name: 'Unlimited (yearly)', amount: 83.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'storytel_unlimited', name: 'Unlimited', amount: 34.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'storytel_unlimited_yearly', name: 'Unlimited (yearly)', amount: 299, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'fortnite_crew',
    name: 'Fortnite Crew',
    color: '#7A4CFF',
    emoji: '🎮',
    initial: 'F',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catGaming',
    key: 'ubisoft_plus',
    name: 'Ubisoft+',
    color: '#0070FF',
    emoji: '🎮',
    initial: 'U+',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catGaming',
    key: 'discord_nitro',
    name: 'Discord Nitro',
    color: '#5865F2',
    emoji: '💬',
    initial: 'D',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'discord_nitro_nitro', name: 'Nitro', amount: 39.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'discord_nitro_basic', name: 'Nitro Basic', amount: 11.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'discord_nitro_yearly', name: 'Nitro (yearly)', amount: 384.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catGaming',
    key: 'twitch',
    name: 'Twitch',
    color: '#9146FF',
    emoji: '🎮',
    initial: 'T',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'canva',
    name: 'Canva',
    color: '#00C4CC',
    emoji: '🎨',
    initial: 'C',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'canva_pro', name: 'Pro', amount: 47.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'canva_pro_yearly', name: 'Pro (yearly)', amount: 439.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'canva_business', name: 'Business', amount: 70, cycle: 'monthly', description: 'Per person', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'canva_pro_yearly', name: 'Pro (yearly)', amount: 1920, cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'canva_business_yearly', name: 'Business (yearly)', amount: 3400, cycle: 'yearly', description: 'Per person', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'adobe_creative_cloud',
    name: 'Adobe Creative Cloud',
    color: '#FA0F00',
    emoji: '🅰️',
    initial: 'Ad',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'figma',
    name: 'Figma',
    color: '#F24E1E',
    emoji: '✏️',
    initial: 'F',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'evernote',
    name: 'Evernote',
    color: '#00A82D',
    emoji: '🐘',
    initial: 'E',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'onepassword',
    name: '1Password',
    color: '#0572EC',
    emoji: '🔑',
    initial: '1P',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catAiProductivity',
    key: 'bitwarden',
    name: 'Bitwarden',
    color: '#175DDC',
    emoji: '🔑',
    initial: 'BW',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catVpn',
    key: 'proton',
    name: 'Proton',
    color: '#6D4AFF',
    emoji: '🛡️',
    initial: 'P',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'proton_unlimited', name: 'Unlimited', amount: 12.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'proton_unlimited_yearly', name: 'Unlimited (yearly)', amount: 119.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'proton_mail_plus', name: 'Mail Plus', amount: 4.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'proton_mail_plus_yearly', name: 'Mail Plus (yearly)', amount: 47.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      egypt: [
        { id: 'proton_unlimited', name: 'Unlimited', amount: 12.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'proton_unlimited_yearly', name: 'Unlimited (yearly)', amount: 119.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'proton_mail_plus', name: 'Mail Plus', amount: 4.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'proton_mail_plus_yearly', name: 'Mail Plus (yearly)', amount: 47.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'proton_unlimited', name: 'Unlimited', amount: 12.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'proton_unlimited_yearly', name: 'Unlimited (yearly)', amount: 119.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
        { id: 'proton_mail_plus', name: 'Mail Plus', amount: 4.99, currency: 'USD', cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'proton_mail_plus_yearly', name: 'Mail Plus (yearly)', amount: 47.88, currency: 'USD', cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'starlink',
    name: 'Starlink',
    color: '#000000',
    emoji: '🛰️',
    initial: 'SL',
    defaultCategory: 'Utilities',
    availability: ['egypt'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'duolingo',
    name: 'Duolingo',
    color: '#58CC02',
    emoji: '🦉',
    initial: 'D',
    defaultCategory: 'Education',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'duolingo_super', name: 'Super', amount: 29.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'duolingo_super_yearly', name: 'Super (yearly)', amount: 199.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'duolingo_super', name: 'Super', amount: 34.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'duolingo_super_yearly', name: 'Super (yearly)', amount: 209.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catOther',
    key: 'linkedin_premium',
    name: 'LinkedIn Premium',
    color: '#0A66C2',
    emoji: '💼',
    initial: 'in',
    defaultCategory: 'Education',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'linkedin_premium_career', name: 'Premium Career', amount: 149.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'linkedin_premium_business', name: 'Premium Business', amount: 249.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'linkedin_premium_career', name: 'Premium Career', amount: 179.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'linkedin_premium_business', name: 'Premium Business', amount: 299.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catOther',
    key: 'coursera',
    name: 'Coursera Plus',
    color: '#0056D2',
    emoji: '🎓',
    initial: 'C',
    defaultCategory: 'Education',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'skillshare',
    name: 'Skillshare',
    color: '#00B368',
    emoji: '🎓',
    initial: 'S',
    defaultCategory: 'Education',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'masterclass',
    name: 'MasterClass',
    color: '#111111',
    emoji: '🎓',
    initial: 'M',
    defaultCategory: 'Education',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'calm',
    name: 'Calm',
    color: '#4AA3DF',
    emoji: '🧘',
    initial: 'C',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'headspace',
    name: 'Headspace',
    color: '#F47D31',
    emoji: '🧘',
    initial: 'H',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'headspace_plus', name: 'Plus', amount: 47.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'headspace_plus_yearly', name: 'Plus (yearly)', amount: 349.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catFitness',
    key: 'golds_gym',
    name: 'Gold\'s Gym',
    color: '#F2B705',
    emoji: '🏋️',
    initial: 'G',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'fitness_time',
    name: 'Fitness Time',
    color: '#F58220',
    emoji: '🏋️',
    initial: 'FT',
    defaultCategory: 'Enjoyment',
    availability: ['saudi'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'anytime_fitness',
    name: 'Anytime Fitness',
    color: '#5B2D8E',
    emoji: '🏋️',
    initial: 'AF',
    defaultCategory: 'Enjoyment',
    availability: ['uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'fitness_first',
    name: 'Fitness First',
    color: '#E2231A',
    emoji: '🏋️',
    initial: 'FF',
    defaultCategory: 'Enjoyment',
    availability: ['uae'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'gymnation',
    name: 'Gymnation',
    color: '#F4A300',
    emoji: '🏋️',
    initial: 'GN',
    defaultCategory: 'Enjoyment',
    availability: ['uae'],
    plans: {},
  },
  {
    catalogSection: 'catFitness',
    key: 'classpass',
    name: 'ClassPass',
    color: '#1B1B1B',
    emoji: '🏃',
    initial: 'CP',
    defaultCategory: 'Enjoyment',
    availability: ['uae'],
    plans: {},
  },
  {
    catalogSection: 'catReading',
    key: 'nytimes',
    name: 'The New York Times',
    color: '#000000',
    emoji: '📰',
    initial: 'NYT',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'nytimes_news', name: 'News (iOS)', amount: 29.99, cycle: 'monthly', description: 'App Store price', verifiedAt: '2026-10-17' },
        { id: 'nytimes_all_access', name: 'All Access (iOS)', amount: 49.99, cycle: 'monthly', description: 'App Store price', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'nytimes_news', name: 'News (iOS)', amount: 34.99, cycle: 'monthly', description: 'App Store price', verifiedAt: '2026-10-17' },
        { id: 'nytimes_all_access', name: 'All Access (iOS)', amount: 49.99, cycle: 'monthly', description: 'App Store price', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catReading',
    key: 'economist',
    name: 'The Economist',
    color: '#E3120B',
    emoji: '📰',
    initial: 'E',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catReading',
    key: 'medium',
    name: 'Medium',
    color: '#000000',
    emoji: '✍️',
    initial: 'M',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'medium_member', name: 'Membership', amount: 19.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'medium_member_yearly', name: 'Membership (yearly)', amount: 199.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'medium_member', name: 'Membership', amount: 19.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'medium_member_yearly', name: 'Membership (yearly)', amount: 199.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catReading',
    key: 'substack',
    name: 'Substack',
    color: '#FF6719',
    emoji: '📰',
    initial: 'S',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'patreon',
    name: 'Patreon',
    color: '#FF424D',
    emoji: '🎗️',
    initial: 'P',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catCommunication',
    key: 'telegram_premium',
    name: 'Telegram Premium',
    color: '#26A5E4',
    emoji: '✈️',
    initial: 'T',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'telegram_premium_monthly', name: 'Monthly', amount: 17.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'telegram_premium_yearly', name: 'Yearly', amount: 129.99, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'telegram_premium_monthly', name: 'Monthly', amount: 20.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catCommunication',
    key: 'x_premium',
    name: 'X Premium',
    color: '#000000',
    emoji: '𝕏',
    initial: 'X',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'x_premium_basic', name: 'Basic', amount: 9.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'x_premium_premium', name: 'Premium', amount: 30, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'x_premium_basic', name: 'Basic', amount: 10, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'x_premium_premium', name: 'Premium', amount: 30, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catCommunication',
    key: 'snapchat_plus',
    name: 'Snapchat+',
    color: '#FFFC00',
    emoji: '👻',
    initial: 'S+',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      uae: [
        { id: 'snapchat_plus_monthly', name: 'Monthly', amount: 14.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
      saudi: [
        { id: 'snapchat_plus_monthly', name: 'Monthly', amount: 16.99, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catCommunication',
    key: 'tinder',
    name: 'Tinder',
    color: '#FE3C72',
    emoji: '🔥',
    initial: 'T',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catCommunication',
    key: 'bumble',
    name: 'Bumble',
    color: '#FFC629',
    emoji: '🐝',
    initial: 'B',
    defaultCategory: 'Enjoyment',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'talabat_pro',
    name: 'talabat Pro',
    color: '#FF5A00',
    emoji: '🛵',
    initial: 'T',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae'],
    plans: {
      egypt: [
        { id: 'talabat_pro_monthly', name: 'Monthly', amount: 79, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'talabat_pro_yearly', name: 'Annual', amount: 799, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catOther',
    key: 'noon_one',
    name: 'noon One',
    color: '#FEEE00',
    emoji: '🛍️',
    initial: 'n',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'careem_plus',
    name: 'Careem Plus',
    color: '#00B26F',
    emoji: '🚕',
    initial: 'C+',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'uber_one',
    name: 'Uber One',
    color: '#000000',
    emoji: '🚗',
    initial: 'U1',
    defaultCategory: 'Other',
    availability: ['egypt', 'uae', 'saudi'],
    plans: {
      egypt: [
        { id: 'uber_one_monthly', name: 'Monthly', amount: 85, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'uber_one_yearly', name: 'Annual', amount: 850, cycle: 'yearly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catOther',
    key: 'jahez',
    name: 'Jahez',
    color: '#E4002B',
    emoji: '🍔',
    initial: 'J',
    defaultCategory: 'Food',
    availability: ['saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'hungerstation',
    name: 'HungerStation',
    color: '#FFC600',
    emoji: '🍔',
    initial: 'H',
    defaultCategory: 'Food',
    availability: ['saudi'],
    plans: {},
  },
  {
    catalogSection: 'catOther',
    key: 'deliveroo_plus',
    name: 'Deliveroo Plus',
    color: '#00CCBC',
    emoji: '🛵',
    initial: 'D+',
    defaultCategory: 'Other',
    availability: ['uae'],
    plans: {},
  },
  {
    catalogSection: 'catTelecom',
    key: 'salam_ksa',
    name: 'Salam Mobile',
    color: '#1E3A8A',
    emoji: '📱',
    initial: 'S',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    plans: {
      saudi: [
        { id: 'salam_ksa_solo_74', name: 'Solo 74', amount: 85.68, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'salam_ksa_solo_99', name: 'Solo 99', amount: 113.85, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'salam_ksa_solo_digital_esim', name: 'Solo Digital eSIM', amount: 171.35, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'virgin_ksa',
    name: 'Virgin Mobile KSA',
    color: '#E10A0A',
    emoji: '📱',
    initial: 'V',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    plans: {
      saudi: [
        { id: 'virgin_ksa_switch_120', name: 'Switch 120', amount: 138, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_switch_150', name: 'Switch 150', amount: 172.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_switch_180', name: 'Switch 180', amount: 207, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_switch_200', name: 'Switch 200', amount: 230, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_switch_250', name: 'Switch 250', amount: 287.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_switch_300', name: 'Switch 300', amount: 345, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_switch_365', name: 'Switch 365', amount: 419.75, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'virgin_ksa_vnet_355', name: 'Vnet 355 (5G home)', amount: 408.25, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'virgin_uae',
    name: 'Virgin Mobile UAE',
    color: '#E10A0A',
    emoji: '📱',
    initial: 'V',
    defaultCategory: 'Utilities',
    availability: ['uae'],
    plans: {},
  },
  {
    catalogSection: 'catTelecom',
    key: 'lebara_ksa',
    name: 'Lebara KSA',
    color: '#E5006D',
    emoji: '📱',
    initial: 'L',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    plans: {},
  },
  {
    catalogSection: 'catTelecom',
    key: 'stc_home',
    name: 'stc Baity',
    color: '#4F008C',
    emoji: '🏠',
    initial: 'stc',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    plans: {
      saudi: [
        { id: 'stc_home_fiber_basic', name: 'Baity Fiber Basic 300 Mbps', amount: 287.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_fiber_stream', name: 'Baity Fiber Stream 500 Mbps', amount: 402.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_fiber_entertainment', name: 'Baity Fiber Entertainment 500 Mbps', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_stream_lite', name: 'Baity Stream Lite 500 Mbps', amount: 345, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_data_lite', name: 'Baity Data Lite', amount: 30, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_5g_basic', name: 'Baity 5G Basic 200 Mbps', amount: 299, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_5g_entertainment', name: 'Baity 5G Entertainment', amount: 353, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_5g_unlimited', name: 'Baity 5G Unlimited', amount: 402.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_fiber_entertainment_pro', name: 'Baity Fiber Entertainment Pro 500 Mbps', amount: 690, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_fiber_stream_pro', name: 'Baity Fiber Stream Pro 500 Mbps', amount: 575, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_fiber_max', name: 'Baity Fiber Max 1 Gbps', amount: 920, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_5g_unlimited_pro', name: 'Baity 5G Unlimited Pro', amount: 696, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'stc_home_5g_max', name: 'Baity 5G Max', amount: 862, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'mobily_home',
    name: 'Mobily Home Fiber',
    color: '#00A651',
    emoji: '🏠',
    initial: 'M',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    plans: {
      saudi: [
        { id: 'mobily_home_fiber_300', name: 'Home Fiber Postpaid 300', amount: 172.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fiber_400', name: 'Home Fiber Postpaid 400', amount: 207, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fiber_500', name: 'Home Fiber Postpaid 500', amount: 241.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fiber_gamers', name: 'Home Fiber Gamers 500 Mbps', amount: 402.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fiber_1gb', name: 'Home Fiber Postpaid 1 Gb', amount: 552, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fttr_400', name: 'Home FTTR 400', amount: 402.5, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fttr_500', name: 'Home FTTR 500', amount: 460, cycle: 'monthly', verifiedAt: '2026-10-17' },
        { id: 'mobily_home_fttr_1g', name: 'Home FTTR 1 Gbps', amount: 920, cycle: 'monthly', verifiedAt: '2026-10-17' },
      ],
    },
  },
  {
    catalogSection: 'catTelecom',
    key: 'zain_home',
    name: 'Zain Home',
    color: '#7B2D8E',
    emoji: '🏠',
    initial: 'Z',
    defaultCategory: 'Utilities',
    availability: ['saudi'],
    plans: {},
  },
]
