export const SITE_URL = 'https://buddget.app'

export type SiteLocale = 'en' | 'ar'
export const SITE_LOCALES: readonly SiteLocale[] = ['en', 'ar']

export const SUPPORT_EMAIL = 'support@buddget.app'

/** Profile URLs. Empty shows an inert placeholder button; fill the URL to make it a live link. */
export const SOCIAL_LINKS: readonly { id: string; label: string; short: string; url: string }[] = [
  { id: 'instagram', label: 'Instagram', short: 'IG', url: '' },
  { id: 'tiktok', label: 'TikTok', short: 'TT', url: '' },
  { id: 'x', label: 'X', short: 'X', url: '' },
  { id: 'linkedin', label: 'LinkedIn', short: 'in', url: '' },
  { id: 'youtube', label: 'YouTube', short: 'YT', url: '' },
  { id: 'facebook', label: 'Facebook', short: 'f', url: '' },
]

/**
 * Launch switch, one value per store. While false the site shows that store's badge as "coming soon" and sends
 * visitors to the waitlist; set it to true the day the listing is approved and the badge becomes a real link.
 * The App Store URL needs the numeric app id from App Store Connect (App Information > Apple ID) before it is turned on.
 */
export const STORE_LIVE = { appStore: false, googlePlay: false }

const STORE_URLS = {
  appStore: '',
  googlePlay: 'https://play.google.com/store/apps/details?id=app.buddget',
}

/** A store's listing URL once it is live and known, else null. */
export const STORE_LINKS: { appStore: string | null; googlePlay: string | null } = {
  appStore: STORE_LIVE.appStore && STORE_URLS.appStore ? STORE_URLS.appStore : null,
  googlePlay: STORE_LIVE.googlePlay && STORE_URLS.googlePlay ? STORE_URLS.googlePlay : null,
}

/** Sample reviews are a design placeholder. They never render in production unless this is set. */
export const SHOW_SAMPLE_REVIEWS = process.env.NEXT_PUBLIC_SITE_SAMPLE_REVIEWS === '1'
