import type { SubscriptionBillingCycle } from '@/lib/store/types'

export interface SubscriptionPlan {
  name: string
  amount: number
  cycle: SubscriptionBillingCycle
  description?: string
}

export type CatalogRegion = 'uae' | 'egypt'

export type CatalogSectionKey =
  | 'catStreaming'
  | 'catMusic'
  | 'catCloudAi'
  | 'catGaming'
  | 'catFitness'
  | 'catOther'

export interface SubscriptionBrand {
  key: string
  name: string
  color: string
  emoji: string
  initial: string
  defaultCategory: string
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

const STREAMING_KEYS = new Set([
  'netflix',
  'shahid_vip',
  'watchit',
  'disney_plus',
  'osn_plus',
  'youtube_premium',
  'prime_video',
  'apple_tv_plus',
])
const MUSIC_KEYS = new Set(['spotify', 'apple_music'])
const CLOUD_AI_KEYS = new Set(['icloud', 'google_one', 'chatgpt_plus', 'claude_pro', 'notion'])
const GAMING_KEYS = new Set(['playstation_plus', 'xbox_gamepass'])
const FITNESS_KEYS = new Set(['gym'])

export function getCatalogSectionForBrandKey(key: string): CatalogSectionKey {
  if (STREAMING_KEYS.has(key)) return 'catStreaming'
  if (MUSIC_KEYS.has(key)) return 'catMusic'
  if (CLOUD_AI_KEYS.has(key)) return 'catCloudAi'
  if (GAMING_KEYS.has(key)) return 'catGaming'
  if (FITNESS_KEYS.has(key)) return 'catFitness'
  return 'catOther'
}

export const CATALOG_SECTION_ORDER: CatalogSectionKey[] = [
  'catStreaming',
  'catMusic',
  'catCloudAi',
  'catGaming',
  'catFitness',
  'catOther',
]

export function findBrandByKey(key: string | null): SubscriptionBrand | undefined {
  if (!key) return undefined
  return SUBSCRIPTION_CATALOG.find((b) => b.key === key)
}

export const SUBSCRIPTION_CATALOG: SubscriptionBrand[] = [
  {
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
]
