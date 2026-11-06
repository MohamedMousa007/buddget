import { MetadataRoute } from 'next'
import { SITE_LOCALES } from '@/lib/site/config'
import { LEGAL_DOCS, LEGAL_MODIFIED, legalUrl } from '@/lib/legal/paths'
import { listRoutes, urlFor } from '@/lib/site/routes'

/**
 * Public marketing URLs only: every website page in both languages with its alternates, plus the legal pages.
 * Authenticated app routes are left out and blocked in robots.txt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = SITE_LOCALES.flatMap((locale) =>
    listRoutes(locale).map((r) => ({
      url: urlFor(locale, r.slug),
      lastModified: r.modified,
      changeFrequency: r.slug === '' || r.slug.startsWith('guides') ? ('weekly' as const) : ('monthly' as const),
      priority: r.priority,
      alternates: {
        languages: {
          en: urlFor('en', r.slug),
          'ar-EG': urlFor('ar', r.slug),
        },
      },
    })),
  )
  const legal: MetadataRoute.Sitemap = LEGAL_DOCS.flatMap((doc) =>
    SITE_LOCALES.map((locale) => ({
      url: legalUrl(doc, locale),
      lastModified: LEGAL_MODIFIED,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
      alternates: { languages: { en: legalUrl(doc, 'en'), 'ar-EG': legalUrl(doc, 'ar') } },
    })),
  )
  return [...pages, ...legal]
}
