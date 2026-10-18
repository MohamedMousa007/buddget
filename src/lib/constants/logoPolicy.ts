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
 * Restricted PNGs are kept out of /public in assets/restricted-subscription-icons/ so they are not
 * bundled. To promote a brand: move its PNG back to public/subscription-icons/ and flip it here.
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
  adobe_creative_cloud: 'initials', // RED USE_INITIALS
  anghami: 'initials', // YELLOW USE_INITIALS
  apple_arcade: 'initials', // RED USE_INITIALS
  apple_fitness: 'initials', // RED USE_INITIALS
  apple_music: 'initials', // RED USE_INITIALS
  apple_tv_plus: 'initials', // RED USE_INITIALS
  audible: 'initials', // YELLOW USE_INITIALS
  aws: 'initials', // RED USE_INITIALS
  breadfast: 'initials', // YELLOW USE_INITIALS
  bumble: 'initials', // YELLOW USE_INITIALS
  calm: 'initials', // RED USE_INITIALS
  canva: 'initials', // RED USE_INITIALS
  careem_plus: 'initials', // YELLOW USE_INITIALS
  carrefour_mylo: 'initials', // YELLOW USE_INITIALS
  chefaa: 'initials', // YELLOW USE_INITIALS
  claude_pro: 'initials', // RED USE_INITIALS
  cloudflare: 'initials', // RED USE_INITIALS
  coursera: 'initials', // YELLOW USE_INITIALS
  deezer: 'initials', // YELLOW USE_INITIALS
  digitalocean: 'initials', // RED USE_INITIALS
  du_home: 'initials', // UNASSESSED USE_INITIALS
  du_mobile: 'initials', // UNASSESSED USE_INITIALS
  duolingo: 'initials', // YELLOW USE_INITIALS
  ea_play: 'initials', // YELLOW USE_INITIALS
  economist: 'initials', // RED USE_INITIALS
  elmenus: 'initials', // YELLOW USE_INITIALS
  etisalat_eg: 'initials', // YELLOW USE_INITIALS
  etisalat_uae: 'initials', // UNASSESSED USE_INITIALS
  fortnite_crew: 'initials', // YELLOW USE_INITIALS
  github_copilot: 'initials', // YELLOW USE_INITIALS
  godaddy: 'initials', // RED USE_INITIALS
  golds_gym: 'initials', // YELLOW USE_INITIALS
  google_gemini: 'initials', // RED USE_INITIALS
  google_one: 'initials', // RED USE_INITIALS
  google_play_pass: 'initials', // RED USE_INITIALS
  gym: 'initials', // GREEN USE_INITIALS
  headspace: 'initials', // YELLOW USE_INITIALS
  hulu: 'initials', // UNASSESSED USE_INITIALS
  icloud: 'initials', // RED USE_INITIALS
  instashop: 'initials', // YELLOW USE_INITIALS
  kindle_unlimited: 'initials', // YELLOW USE_INITIALS
  linkedin_premium: 'initials', // YELLOW USE_INITIALS
  masterclass: 'initials', // YELLOW USE_INITIALS
  microsoft_365: 'initials', // RED USE_INITIALS
  mrsool: 'initials', // YELLOW USE_INITIALS
  myfitnesspal: 'initials', // YELLOW USE_INITIALS
  nintendo_switch_online: 'initials', // RED USE_INITIALS
  noon_one: 'initials', // YELLOW USE_INITIALS
  nordvpn: 'initials', // RED USE_INITIALS
  nytimes: 'initials', // RED USE_INITIALS
  orange_eg: 'initials', // YELLOW USE_INITIALS
  paramount_plus: 'initials', // UNASSESSED USE_INITIALS
  peacock: 'initials', // UNASSESSED USE_INITIALS
  playstation_plus: 'initials', // YELLOW USE_INITIALS
  prime_video: 'initials', // RED USE_INITIALS
  rabbit: 'initials', // YELLOW USE_INITIALS
  roblox_premium: 'initials', // RED USE_INITIALS
  scribd: 'initials', // YELLOW USE_INITIALS
  skillshare: 'initials', // YELLOW USE_INITIALS
  snapchat_plus: 'initials', // YELLOW USE_INITIALS
  storytel: 'initials', // YELLOW USE_INITIALS
  strava: 'initials', // YELLOW USE_INITIALS
  surfshark: 'initials', // RED USE_INITIALS
  talabat_pro: 'initials', // YELLOW USE_INITIALS
  telegram_premium: 'initials', // YELLOW USE_INITIALS
  tinder: 'initials', // YELLOW USE_INITIALS
  twitch: 'initials', // YELLOW USE_INITIALS
  uber_one: 'initials', // RED USE_INITIALS
  ubisoft_plus: 'initials', // YELLOW USE_INITIALS
  udemy: 'initials', // RED USE_INITIALS
  vezeeta: 'initials', // YELLOW USE_INITIALS
  vodafone_eg: 'initials', // YELLOW USE_INITIALS
  we_internet: 'initials', // YELLOW USE_INITIALS
  x_premium: 'initials', // YELLOW USE_INITIALS
  xbox_gamepass: 'initials', // RED USE_INITIALS
  youtube_music: 'initials', // YELLOW USE_INITIALS
  youtube_premium: 'initials', // RED USE_INITIALS
  zoom_pro: 'initials', // RED USE_INITIALS
}

export function logoAllowed(brandKey: string | null | undefined): boolean {
  return !!brandKey && LOGO_POLICY[brandKey] === 'logo'
}
