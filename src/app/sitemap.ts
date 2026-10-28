import { MetadataRoute } from 'next'
import { SITE_URL, SITE_LOCALES } from '@/lib/site/config'
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
  const legal: MetadataRoute.Sitemap = ['privacy', 'terms'].map((p) => ({
    url: `${SITE_URL}/legal/${p}`,
    lastModified: '2026-10-28',
    changeFrequency: 'monthly' as const,
    priority: 0.3,
  }))
  return [...pages, ...legal]
}
