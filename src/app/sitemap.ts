import { MetadataRoute } from 'next'

/**
 * Public marketing URLs only.
 *
 * Intentionally excluded from this sitemap (use robots.txt disallow / noindex as applicable):
 * `/onboarding`, `/onboarding/step/*`, `/onboarding/preview`, `/budget-preview`, and all authenticated app routes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://buddget.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://buddget.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://buddget.app/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
