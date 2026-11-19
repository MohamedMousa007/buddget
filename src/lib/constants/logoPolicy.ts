/**
 * Which brands may show their real logo. Generated from the 2026-10-18 logo-use research
 * (docs/subscriptions-redesign/logo-legal/): this is a risk assessment, not legal advice.
 *
 * 'logo'     = USE_LOGO / USE_LOGO_WITH_CONDITIONS. Conditions: show the logo unmodified, only to
 *              identify the user's own subscription, never in marketing or store assets, with the
 *              'trademarks belong to their owners' notice in Terms.
 * 'initials' = RED, UNASSESSED or low-confidence YELLOW: render the initials tile. Unlisted brands
 *              are 'initials' too, so a new brand never ships a logo by accident.
 *
 * 2026-11-19 owner decision: every brand that has an image ships its real logo, including the ones
 * the research rated RED, accepting the trademark-complaint risk. Keep them out of marketing and
 * store assets. The source PNGs stay in assets/restricted-subscription-icons/; a brand with no image
 * renders initials. To pull one back: delete its WebP from public/subscription-icons/ and flip it here.
 */
export type LogoPolicy = 'logo' | 'initials'

export const LOGO_POLICY: Record<string, LogoPolicy> = {
  bein_sports: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  bitwarden: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  chatgpt_plus: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  crunchyroll: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  cursor: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  discord_nitro: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  disney_plus: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  dropbox: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  evernote: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  expressvpn: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  figma: 'logo', // GREEN USE_LOGO_WITH_CONDITIONS
  grammarly: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  hbo_max: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  indrive: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  jawwy_tv: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  medium: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  midjourney: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  mubi: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  namecheap: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  netflix: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  notion: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  onepassword: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  osn_plus: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  patreon: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  perplexity_pro: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  proton: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  shahid_vip: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  slack_pro: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  spotify: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  starlink: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  starzplay: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  substack: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  swvl: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  tod: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  viu: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  watchit: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  weyyak: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  yango_play: 'logo', // YELLOW USE_LOGO_WITH_CONDITIONS
  adobe_creative_cloud: 'logo', // RED owner decision 2026-11-19: real logo
  anghami: 'logo', // YELLOW owner decision 2026-11-19: real logo
  apple_arcade: 'logo', // RED owner decision 2026-11-19: real logo
  apple_fitness: 'logo', // RED owner decision 2026-11-19: real logo
  apple_music: 'logo', // RED owner decision 2026-11-19: real logo
  apple_tv_plus: 'logo', // RED owner decision 2026-11-19: real logo
  audible: 'logo', // YELLOW owner decision 2026-11-19: real logo
  aws: 'logo', // RED owner decision 2026-11-19: real logo
  breadfast: 'logo', // YELLOW owner decision 2026-11-19: real logo
  bumble: 'logo', // YELLOW owner decision 2026-11-19: real logo
  calm: 'logo', // RED owner decision 2026-11-19: real logo
  canva: 'logo', // RED owner decision 2026-11-19: real logo
  careem_plus: 'logo', // YELLOW owner decision 2026-11-19: real logo
  carrefour_mylo: 'logo', // YELLOW owner decision 2026-11-19: real logo
  chefaa: 'logo', // YELLOW owner decision 2026-11-19: real logo
  claude_pro: 'logo', // RED owner decision 2026-11-19: real logo
  cloudflare: 'logo', // RED owner decision 2026-11-19: real logo
  coursera: 'logo', // YELLOW owner decision 2026-11-19: real logo
  deezer: 'logo', // YELLOW owner decision 2026-11-19: real logo
  digitalocean: 'logo', // RED owner decision 2026-11-19: real logo
  du_home: 'logo', // UNASSESSED owner decision 2026-11-19: real logo
  du_mobile: 'logo', // UNASSESSED owner decision 2026-11-19: real logo
  duolingo: 'logo', // YELLOW owner decision 2026-11-19: real logo
  ea_play: 'logo', // YELLOW owner decision 2026-11-19: real logo
  economist: 'logo', // RED owner decision 2026-11-19: real logo
  elmenus: 'logo', // YELLOW owner decision 2026-11-19: real logo
  etisalat_eg: 'logo', // YELLOW owner decision 2026-11-19: real logo
  etisalat_uae: 'logo', // UNASSESSED owner decision 2026-11-19: real logo
  fortnite_crew: 'logo', // YELLOW owner decision 2026-11-19: real logo
  github_copilot: 'logo', // YELLOW owner decision 2026-11-19: real logo
  godaddy: 'logo', // RED owner decision 2026-11-19: real logo
  golds_gym: 'initials', // YELLOW USE_INITIALS
  google_gemini: 'logo', // RED owner decision 2026-11-19: real logo
  google_one: 'logo', // RED owner decision 2026-11-19: real logo
  google_play_pass: 'logo', // RED owner decision 2026-11-19: real logo
  gym: 'logo', // GREEN owner decision 2026-11-19: real logo
  headspace: 'logo', // YELLOW owner decision 2026-11-19: real logo
  hulu: 'logo', // UNASSESSED owner decision 2026-11-19: real logo
  icloud: 'logo', // RED owner decision 2026-11-19: real logo
  instashop: 'logo', // YELLOW owner decision 2026-11-19: real logo
  kindle_unlimited: 'logo', // YELLOW owner decision 2026-11-19: real logo
  linkedin_premium: 'logo', // YELLOW owner decision 2026-11-19: real logo
  masterclass: 'logo', // YELLOW owner decision 2026-11-19: real logo
  microsoft_365: 'logo', // RED owner decision 2026-11-19: real logo
  mrsool: 'logo', // YELLOW owner decision 2026-11-19: real logo
  myfitnesspal: 'logo', // YELLOW owner decision 2026-11-19: real logo
  nintendo_switch_online: 'logo', // RED owner decision 2026-11-19: real logo
  noon_one: 'logo', // YELLOW owner decision 2026-11-19: real logo
  nordvpn: 'logo', // RED owner decision 2026-11-19: real logo
  nytimes: 'logo', // RED owner decision 2026-11-19: real logo
  orange_eg: 'logo', // YELLOW owner decision 2026-11-19: real logo
  paramount_plus: 'logo', // UNASSESSED owner decision 2026-11-19: real logo
  peacock: 'logo', // UNASSESSED owner decision 2026-11-19: real logo
  playstation_plus: 'logo', // YELLOW owner decision 2026-11-19: real logo
  prime_video: 'logo', // RED owner decision 2026-11-19: real logo
  rabbit: 'logo', // YELLOW owner decision 2026-11-19: real logo
  roblox_premium: 'logo', // RED owner decision 2026-11-19: real logo
  scribd: 'logo', // YELLOW owner decision 2026-11-19: real logo
  skillshare: 'logo', // YELLOW owner decision 2026-11-19: real logo
  snapchat_plus: 'logo', // YELLOW owner decision 2026-11-19: real logo
  storytel: 'logo', // YELLOW owner decision 2026-11-19: real logo
  strava: 'logo', // YELLOW owner decision 2026-11-19: real logo
  surfshark: 'logo', // RED owner decision 2026-11-19: real logo
  talabat_pro: 'logo', // YELLOW owner decision 2026-11-19: real logo
  telegram_premium: 'logo', // YELLOW owner decision 2026-11-19: real logo
  tinder: 'logo', // YELLOW owner decision 2026-11-19: real logo
  twitch: 'logo', // YELLOW owner decision 2026-11-19: real logo
  uber_one: 'logo', // RED owner decision 2026-11-19: real logo
  ubisoft_plus: 'logo', // YELLOW owner decision 2026-11-19: real logo
  udemy: 'logo', // RED owner decision 2026-11-19: real logo
  vezeeta: 'logo', // YELLOW owner decision 2026-11-19: real logo
  vodafone_eg: 'logo', // YELLOW owner decision 2026-11-19: real logo
  we_internet: 'logo', // YELLOW owner decision 2026-11-19: real logo
  x_premium: 'logo', // YELLOW owner decision 2026-11-19: real logo
  xbox_gamepass: 'logo', // RED owner decision 2026-11-19: real logo
  youtube_music: 'logo', // YELLOW owner decision 2026-11-19: real logo
  youtube_premium: 'logo', // RED owner decision 2026-11-19: real logo
  zoom_pro: 'logo', // RED owner decision 2026-11-19: real logo
}

export function logoAllowed(brandKey: string | null | undefined): boolean {
  return !!brandKey && LOGO_POLICY[brandKey] === 'logo'
}
