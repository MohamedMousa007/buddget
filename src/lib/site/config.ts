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

/** Store listings. Null until each listing is live; the download page shows the beta list instead. */
export const STORE_LINKS: { appStore: string | null; googlePlay: string | null } = {
  appStore: null,
  googlePlay: null,
}

/** Sample reviews are a design placeholder. They never render in production unless this is set. */
export const SHOW_SAMPLE_REVIEWS = process.env.NEXT_PUBLIC_SITE_SAMPLE_REVIEWS === '1'

export const WEB_APP_PATH = '/flow'
