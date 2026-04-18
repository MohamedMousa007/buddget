import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://buddget.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://buddget.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://buddget.app/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
