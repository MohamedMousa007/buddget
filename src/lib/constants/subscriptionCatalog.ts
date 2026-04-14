import type { SubscriptionBillingCycle } from '@/lib/store/types'

export interface SubscriptionPlan {
  name: string
  amount: number
  cycle: SubscriptionBillingCycle
  description?: string
}

export type CatalogRegion = 'uae' | 'egypt'

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
  availability: ('uae' | 'egypt')[]
  plans: Record<CatalogRegion, SubscriptionPlan[]>
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

  return null
}

/** Currency for each catalog region */
export const REGION_CURRENCY: Record<CatalogRegion, string> = {
  uae: 'AED',
  egypt: 'EGP',
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
 * When region is null: brands available in both UAE and Egypt (global / MENA-wide in catalog).
 */
export function filterVisibleBrands(
  catalog: SubscriptionBrand[],
  region: CatalogRegion | null
): SubscriptionBrand[] {
  if (region) {
    return catalog.filter((b) => b.availability.includes(region))
  }
  return catalog.filter((b) => b.availability.includes('uae') && b.availability.includes('egypt'))
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
        { name: 'Basic', amount: 35, cycle: 'monthly', description: 'HD, 1 screen' },
        { name: 'Standard', amount: 49, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { name: 'Premium', amount: 71, cycle: 'monthly', description: '4K UHD, 4 screens' },
      ],
      egypt: [
        { name: 'Basic', amount: 70, cycle: 'monthly', description: 'HD, 1 screen' },
        { name: 'Standard', amount: 120, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { name: 'Premium', amount: 165, cycle: 'monthly', description: '4K UHD, 4 screens' },
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
        { name: 'VIP', amount: 24, cycle: 'monthly' },
        { name: 'VIP Sports', amount: 45, cycle: 'monthly' },
        { name: 'VIP Annual', amount: 240, cycle: 'yearly' },
      ],
      egypt: [
        { name: 'VIP', amount: 100, cycle: 'monthly' },
        { name: 'VIP Sports', amount: 200, cycle: 'monthly' },
        { name: 'VIP Annual', amount: 1000, cycle: 'yearly' },
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
        { name: 'Basic', amount: 120, cycle: 'monthly' },
        { name: 'Premium', amount: 200, cycle: 'monthly' },
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
        { name: 'Standard', amount: 30, cycle: 'monthly' },
        { name: 'Premium', amount: 40, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Standard', amount: 120, cycle: 'monthly' },
        { name: 'Premium', amount: 170, cycle: 'monthly' },
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
        { name: 'Monthly', amount: 30, cycle: 'monthly' },
        { name: 'Annual', amount: 300, cycle: 'yearly' },
      ],
      egypt: [
        { name: 'Monthly', amount: 120, cycle: 'monthly' },
        { name: 'Annual', amount: 1200, cycle: 'yearly' },
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
        { name: 'Individual', amount: 23, cycle: 'monthly' },
        { name: 'Family', amount: 35, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Individual', amount: 66, cycle: 'monthly' },
        { name: 'Family', amount: 100, cycle: 'monthly' },
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { name: 'Individual', amount: 20, cycle: 'monthly' },
        { name: 'Duo', amount: 26, cycle: 'monthly' },
        { name: 'Family', amount: 33, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Individual', amount: 79, cycle: 'monthly' },
        { name: 'Duo', amount: 109, cycle: 'monthly' },
        { name: 'Family', amount: 139, cycle: 'monthly' },
        { name: 'Student', amount: 39, cycle: 'monthly' },
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { name: 'Individual', amount: 17, cycle: 'monthly' },
        { name: 'Family', amount: 26, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Individual', amount: 50, cycle: 'monthly' },
        { name: 'Family', amount: 80, cycle: 'monthly' },
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
      uae: [{ name: 'Monthly', amount: 20, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 50, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 16, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 50, cycle: 'monthly' }],
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { name: '50 GB', amount: 4, cycle: 'monthly' },
        { name: '200 GB', amount: 11, cycle: 'monthly' },
        { name: '2 TB', amount: 37, cycle: 'monthly' },
        { name: '6 TB', amount: 110, cycle: 'monthly' },
        { name: '12 TB', amount: 220, cycle: 'monthly' },
      ],
      egypt: [
        { name: '50 GB', amount: 16, cycle: 'monthly' },
        { name: '200 GB', amount: 45, cycle: 'monthly' },
        { name: '2 TB', amount: 150, cycle: 'monthly' },
        { name: '6 TB', amount: 450, cycle: 'monthly' },
        { name: '12 TB', amount: 900, cycle: 'monthly' },
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
        { name: '100 GB', amount: 7, cycle: 'monthly' },
        { name: '2 TB', amount: 37, cycle: 'monthly' },
      ],
      egypt: [
        { name: '100 GB', amount: 30, cycle: 'monthly' },
        { name: '2 TB', amount: 150, cycle: 'monthly' },
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [
        { name: 'Plus', amount: 73, cycle: 'monthly' },
        { name: 'Pro', amount: 733, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Plus', amount: 300, cycle: 'monthly' },
        { name: 'Pro', amount: 3000, cycle: 'monthly' },
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ name: 'Pro', amount: 73, cycle: 'monthly' }],
      egypt: [{ name: 'Pro', amount: 300, cycle: 'monthly' }],
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ name: 'Plus', amount: 37, cycle: 'monthly' }],
      egypt: [{ name: 'Plus', amount: 150, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 200, cycle: 'monthly', description: 'Adjust to your gym price' }],
      egypt: [{ name: 'Monthly', amount: 500, cycle: 'monthly', description: 'Adjust to your gym price' }],
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
        { name: 'Essential', amount: 20, cycle: 'monthly' },
        { name: 'Extra', amount: 52, cycle: 'monthly' },
        { name: 'Premium', amount: 63, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Essential', amount: 80, cycle: 'monthly' },
        { name: 'Extra', amount: 215, cycle: 'monthly' },
        { name: 'Premium', amount: 260, cycle: 'monthly' },
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
        { name: 'Core', amount: 28, cycle: 'monthly' },
        { name: 'Standard', amount: 55, cycle: 'monthly' },
        { name: 'Ultimate', amount: 68, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Core', amount: 115, cycle: 'monthly' },
        { name: 'Standard', amount: 230, cycle: 'monthly' },
        { name: 'Ultimate', amount: 280, cycle: 'monthly' },
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
      uae: [{ name: 'Monthly', amount: 46, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 190, cycle: 'monthly' }],
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
        { name: '140 GB', amount: 250, cycle: 'monthly' },
        { name: '250 GB', amount: 400, cycle: 'monthly' },
        { name: '500 GB', amount: 600, cycle: 'monthly' },
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
        { name: 'Flex 100', amount: 100, cycle: 'monthly' },
        { name: 'Flex 200', amount: 200, cycle: 'monthly' },
        { name: 'Flex 350', amount: 350, cycle: 'monthly' },
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
        { name: 'Air 100', amount: 100, cycle: 'monthly' },
        { name: 'Air 200', amount: 200, cycle: 'monthly' },
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
        { name: 'Super 100', amount: 100, cycle: 'monthly' },
        { name: 'Super 200', amount: 200, cycle: 'monthly' },
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
        { name: 'Starter', amount: 299, cycle: 'monthly' },
        { name: 'Plus', amount: 449, cycle: 'monthly' },
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
        { name: 'eLife Basic', amount: 319, cycle: 'monthly' },
        { name: 'eLife Plus', amount: 449, cycle: 'monthly' },
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
        { name: 'Postpaid 125', amount: 125, cycle: 'monthly' },
        { name: 'Postpaid 200', amount: 200, cycle: 'monthly' },
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
        { name: 'Mobile', amount: 20, cycle: 'monthly', description: 'HD, 1 screen' },
        { name: 'Basic', amount: 35, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { name: 'Platinum', amount: 50, cycle: 'monthly', description: '4K, 4 screens' },
      ],
      egypt: [
        { name: 'Mobile', amount: 80, cycle: 'monthly', description: 'HD, 1 screen' },
        { name: 'Basic', amount: 140, cycle: 'monthly', description: 'Full HD, 2 screens' },
        { name: 'Platinum', amount: 200, cycle: 'monthly', description: '4K, 4 screens' },
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
        { name: 'Fan', amount: 25, cycle: 'monthly' },
        { name: 'Mega Fan', amount: 35, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Fan', amount: 100, cycle: 'monthly' },
        { name: 'Mega Fan', amount: 140, cycle: 'monthly' },
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
      uae: [{ name: 'With ads', amount: 35, cycle: 'monthly' }, { name: 'No ads', amount: 55, cycle: 'monthly' }],
      egypt: [{ name: 'With ads', amount: 140, cycle: 'monthly' }, { name: 'No ads', amount: 220, cycle: 'monthly' }],
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
      uae: [{ name: 'Essential', amount: 20, cycle: 'monthly' }, { name: 'Premium', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Essential', amount: 80, cycle: 'monthly' }, { name: 'Premium', amount: 140, cycle: 'monthly' }],
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
      uae: [{ name: 'Premium', amount: 25, cycle: 'monthly' }, { name: 'Plus', amount: 40, cycle: 'monthly' }],
      egypt: [{ name: 'Premium', amount: 100, cycle: 'monthly' }, { name: 'Plus', amount: 160, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 40, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 160, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 40, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 160, cycle: 'monthly' }],
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
        { name: 'Plus', amount: 15, cycle: 'monthly' },
        { name: 'Platinum', amount: 25, cycle: 'monthly' },
      ],
      egypt: [
        { name: 'Plus', amount: 60, cycle: 'monthly' },
        { name: 'Platinum', amount: 100, cycle: 'monthly' },
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
      uae: [{ name: 'Entertainment', amount: 35, cycle: 'monthly' }, { name: 'Sports', amount: 55, cycle: 'monthly' }],
      egypt: [{ name: 'Entertainment', amount: 140, cycle: 'monthly' }, { name: 'Sports', amount: 220, cycle: 'monthly' }],
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
      uae: [{ name: 'Basic', amount: 30, cycle: 'monthly' }],
      egypt: [{ name: 'Basic', amount: 120, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 25, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 100, cycle: 'monthly' }],
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
      uae: [{ name: 'Premium', amount: 20, cycle: 'monthly' }],
      egypt: [{ name: 'Premium', amount: 80, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 25, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 100, cycle: 'monthly' }],
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
      uae: [{ name: 'Pro', amount: 80, cycle: 'monthly' }, { name: 'Business', amount: 120, cycle: 'monthly' }],
      egypt: [{ name: 'Pro', amount: 320, cycle: 'monthly' }, { name: 'Business', amount: 480, cycle: 'monthly' }],
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ name: 'Individual', amount: 40, cycle: 'monthly' }, { name: 'Business', amount: 60, cycle: 'monthly' }],
      egypt: [{ name: 'Individual', amount: 160, cycle: 'monthly' }, { name: 'Business', amount: 240, cycle: 'monthly' }],
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
      uae: [{ name: 'Basic', amount: 40, cycle: 'monthly' }, { name: 'Standard', amount: 80, cycle: 'monthly' }],
      egypt: [{ name: 'Basic', amount: 160, cycle: 'monthly' }, { name: 'Standard', amount: 320, cycle: 'monthly' }],
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
      uae: [{ name: 'Pro', amount: 80, cycle: 'monthly' }],
      egypt: [{ name: 'Pro', amount: 320, cycle: 'monthly' }],
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
      uae: [{ name: 'Google AI Pro', amount: 75, cycle: 'monthly' }],
      egypt: [{ name: 'Google AI Pro', amount: 300, cycle: 'monthly' }],
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
      uae: [{ name: 'Premium', amount: 45, cycle: 'monthly' }],
      egypt: [{ name: 'Premium', amount: 180, cycle: 'monthly' }],
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
      uae: [{ name: 'Plus', amount: 45, cycle: 'monthly' }, { name: 'Professional', amount: 120, cycle: 'monthly' }],
      egypt: [{ name: 'Plus', amount: 180, cycle: 'monthly' }, { name: 'Professional', amount: 480, cycle: 'monthly' }],
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
      uae: [{ name: 'Personal', amount: 35, cycle: 'monthly' }, { name: 'Family', amount: 55, cycle: 'monthly' }],
      egypt: [{ name: 'Personal', amount: 140, cycle: 'monthly' }, { name: 'Family', amount: 220, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 100, cycle: 'monthly' }],
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
      uae: [{ name: 'Premium', amount: 40, cycle: 'monthly' }],
      egypt: [{ name: 'Premium', amount: 160, cycle: 'monthly' }],
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
      uae: [{ name: 'Summit', amount: 40, cycle: 'monthly' }],
      egypt: [{ name: 'Summit', amount: 160, cycle: 'monthly' }],
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
      uae: [{ name: 'Pro', amount: 55, cycle: 'monthly' }],
      egypt: [{ name: 'Pro', amount: 220, cycle: 'monthly' }],
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
    availability: ['uae', 'egypt'],
    plans: {
      uae: [{ name: 'Pro', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Pro', amount: 140, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 140, cycle: 'monthly' }],
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
      uae: [{ name: 'Plus', amount: 45, cycle: 'monthly' }],
      egypt: [{ name: 'Plus', amount: 180, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 40, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 160, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 50, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 200, cycle: 'monthly' }],
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
      uae: [{ name: 'Monthly', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Monthly', amount: 140, cycle: 'monthly' }],
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
      uae: [{ name: 'Individual', amount: 20, cycle: 'monthly' }, { name: 'Family', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Individual', amount: 80, cycle: 'monthly' }, { name: 'Family', amount: 140, cycle: 'monthly' }],
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
      uae: [{ name: 'EA Play', amount: 20, cycle: 'monthly' }, { name: 'EA Play Pro', amount: 55, cycle: 'monthly' }],
      egypt: [{ name: 'EA Play', amount: 80, cycle: 'monthly' }, { name: 'EA Play Pro', amount: 220, cycle: 'monthly' }],
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
      uae: [{ name: 'Individual', amount: 23, cycle: 'monthly' }, { name: 'Family', amount: 35, cycle: 'monthly' }],
      egypt: [{ name: 'Individual', amount: 66, cycle: 'monthly' }, { name: 'Family', amount: 100, cycle: 'monthly' }],
    },
  },
]
