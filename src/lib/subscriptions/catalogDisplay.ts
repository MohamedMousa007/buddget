import {
  detectCatalogRegion,
  filterVisibleBrands,
  plansForRegion,
  REGION_CURRENCY,
  SUBSCRIPTION_CATALOG,
  type CatalogRegion,
  type SubscriptionBrand,
  type SubscriptionPlan,
} from '@/lib/constants/subscriptionCatalog'

/** The add flow's category chips (SPEC §9), in display order. */
export const ADD_CATEGORIES = [
  'streaming',
  'music',
  'gaming',
  'telecom',
  'ai',
  'cloud',
  'fitness',
  'shopping',
  'learning',
  'news',
  'other',
] as const
export type AddCategory = (typeof ADD_CATEGORIES)[number]

const BY_SECTION: Record<SubscriptionBrand['catalogSection'], AddCategory> = {
  catStreaming: 'streaming',
  catMusic: 'music',
  catGaming: 'gaming',
  catTelecom: 'telecom',
  catAiProductivity: 'ai',
  catCloudStorage: 'cloud',
  catFitness: 'fitness',
  catVpn: 'ai',
  catReading: 'news',
  catCommunication: 'other',
  catOther: 'other',
}

const SHOPPING = new Set(['talabat_pro', 'noon_one', 'uber_one', 'careem_plus', 'jahez', 'hungerstation', 'deliveroo_plus'])
const LEARNING = new Set(['duolingo', 'coursera', 'skillshare', 'masterclass', 'linkedin_premium', 'storytel'])

export function addCategoryOf(brand: Pick<SubscriptionBrand, 'key' | 'catalogSection'>): AddCategory {
  if (SHOPPING.has(brand.key)) return 'shopping'
  if (LEARNING.has(brand.key)) return 'learning'
  return BY_SECTION[brand.catalogSection]
}

/** "Popular in Egypt": ordered by Egyptian usage (SPEC §6.4). Brands not in the region simply drop out. */
const POPULAR_EGYPT = [
  'netflix', 'shahid_vip', 'spotify', 'anghami', 'youtube_premium', 'watchit', 'prime_video',
  'playstation_plus', 'xbox_gamepass', 'chatgpt_plus', 'microsoft_365', 'icloud', 'google_one',
  'vodafone_eg', 'orange_eg', 'etisalat_eg', 'we_internet', 'golds_gym', 'gym', 'talabat_pro',
  'noon_one', 'uber_one', 'careem_plus',
] as const

/** The plan a brand tile quotes and preselects. Netflix leads with Standard; elsewhere the first plan. */
const DEFAULT_PLAN: Record<string, string> = { netflix: 'netflix_standard' }

export function defaultPlan(brand: SubscriptionBrand, region: CatalogRegion | null): SubscriptionPlan | null {
  const plans = plansForRegion(brand, region)
  return plans.find((p) => p.id === DEFAULT_PLAN[brand.key]) ?? plans[0] ?? null
}

/** Brands for the add grid: visible in the region, filtered by category and search, popular first. */
export function catalogGrid(
  region: CatalogRegion | null,
  category: AddCategory | null,
  query: string,
): SubscriptionBrand[] {
  const q = query.trim().toLowerCase()
  const visible = filterVisibleBrands(SUBSCRIPTION_CATALOG, region)
  const rank = (b: SubscriptionBrand) => {
    const i = (POPULAR_EGYPT as readonly string[]).indexOf(b.key)
    return i === -1 ? POPULAR_EGYPT.length : i
  }
  return visible
    .filter((b) => (category === null || addCategoryOf(b) === category) && (q === '' || b.name.toLowerCase().includes(q) || b.key.includes(q)))
    .sort((a, b) => rank(a) - rank(b))
}

export interface PriceLabel {
  currency: string
  amount: number
  /** Shown with a leading ≈: a USD-billed plan, or a price not verified against a primary source. */
  approx: boolean
}

/** What a tile quotes: typical only when verified, otherwise ≈ and editable on the next step. */
export function tilePrice(plan: SubscriptionPlan, region: CatalogRegion | null): PriceLabel {
  const regionCurrency = region ? REGION_CURRENCY[region] : plan.currency ?? 'EGP'
  const currency = plan.currency ?? regionCurrency
  return { currency, amount: plan.amount, approx: currency !== regionCurrency || !plan.verifiedAt }
}

/** The catalog market for a profile. Egypt is the home market, so an unlocated profile still gets Egyptian plans and prices. */
export function catalogRegionOf(profile: { city?: string; country?: string }): CatalogRegion {
  return detectCatalogRegion(profile) ?? 'egypt'
}
