import { findBrandByKey } from '@/lib/constants/subscriptionCatalog'

/**
 * Two-letter marks for brands whose logo we do not show (see `logoPolicy.ts`). Chosen by hand
 * so each one reads as its service and none repeats: the first letters of the two words that
 * identify it (YouTube Music → YM, Apple TV → AT), or a distinctive pair for a single word
 * (Strava → SR, so it does not collide with stc → SC). Always capitals, the convention for
 * monograms. `brandTile.test.ts` fails if two brands share a mark.
 */
export const BRAND_INITIALS: Record<string, string> = {
  youtube_premium: 'YT', youtube_music: 'YM', apple_music: 'AM', apple_tv_plus: 'AT', apple_fitness: 'AF',
  apple_arcade: 'AA', icloud: 'IC', google_one: 'GO', google_gemini: 'GE', prime_video: 'PV', claude_pro: 'CP',
  gym: 'GM', golds_gym: 'GG', playstation_plus: 'PS', xbox_gamepass: 'XG', nordvpn: 'NV', we_internet: 'WE', vodafone_eg: 'VE',
  orange_eg: 'OE', etisalat_eg: 'ET', du_home: 'DH', etisalat_uae: 'EU', du_mobile: 'DU', stc: 'SC', stc_tv: 'TV',
  stc_home: 'SH', mobily: 'MO', mobily_home: 'MH', zain_ksa: 'ZK', zain_home: 'ZH', hulu: 'HU', paramount_plus: 'PP',
  peacock: 'PE', anghami: 'AN', github_copilot: 'GH', microsoft_365: 'MS', myfitnesspal: 'MP', strava: 'SR',
  zoom_pro: 'ZM', kindle_unlimited: 'KU', audible: 'AD', scribd: 'SD', surfshark: 'SF', nintendo_switch_online: 'NO',
  ea_play: 'EA', storytel: 'ST', deezer: 'DZ', fortnite_crew: 'FN', ubisoft_plus: 'UB', twitch: 'TW', canva: 'CV',
  adobe_creative_cloud: 'AC', duolingo: 'DL', linkedin_premium: 'LI', coursera: 'CO', skillshare: 'SK',
  masterclass: 'MC', calm: 'CM', headspace: 'HS', fitness_time: 'FT', anytime_fitness: 'AY', fitness_first: 'FF',
  gymnation: 'GN', classpass: 'CL', nytimes: 'NY', economist: 'EC', telegram_premium: 'TG', x_premium: 'XP',
  snapchat_plus: 'SN', tinder: 'TI', bumble: 'BU', talabat_pro: 'TB', noon_one: 'NN', careem_plus: 'CA',
  uber_one: 'UO', jahez: 'JA', hungerstation: 'HG', deliveroo_plus: 'DR', salam_ksa: 'SA', virgin_ksa: 'VK',
  virgin_uae: 'VU', lebara_ksa: 'LB',
}

/** Monogram for any service: the curated mark, else the first letters of its first two words (or first two letters), in capitals. */
export function brandInitials(brandKey: string | null | undefined, name: string): string {
  const curated = brandKey ? BRAND_INITIALS[brandKey] : undefined
  if (curated) return curated
  const words = name.trim().split(/\s+/).filter(Boolean)
  const mark = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return mark.toLocaleUpperCase()
}

/** Relative luminance of `#rrggbb`, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The brand's own colour as the tile fill, with whichever of white or black text reads better on it. Null for a custom service. */
export function brandTileColors(brandKey: string | null | undefined): { bg: string; fg: string } | null {
  const color = findBrandByKey(brandKey ?? null)?.color
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null
  // Black text beats white once the fill is light enough (yellow, light green).
  return { bg: color, fg: luminance(color) > 0.4 ? 'black' : 'white' }
}
