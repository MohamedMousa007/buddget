import { SITE_URL, type SiteLocale } from '@/lib/site/config'

export const LEGAL_DOCS = ['privacy', 'terms'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

/** Date of the last change to the legal texts (both languages): shown on the pages and in the sitemap. */
export const LEGAL_MODIFIED = '2026-11-05'

/**
 * Where a legal document lives. English is `/legal/<doc>` (the store policy URL; in the app it follows the
 * app language setting). Arabic has its own URL, `/ar/legal/<doc>`, which is Arabic regardless of any setting.
 */
export function legalPath(doc: LegalDoc, locale: SiteLocale): string {
  return locale === 'ar' ? `/ar/legal/${doc}` : `/legal/${doc}`
}

export function legalUrl(doc: LegalDoc, locale: SiteLocale): string {
  return `${SITE_URL}${legalPath(doc, locale)}`
}

/** Canonical plus hreflang alternates for one language version of a document. */
export function legalAlternates(doc: LegalDoc, page: SiteLocale) {
  return {
    canonical: legalUrl(doc, page),
    languages: { en: legalUrl(doc, 'en'), 'ar-EG': legalUrl(doc, 'ar'), 'x-default': legalUrl(doc, 'en') },
  }
}
