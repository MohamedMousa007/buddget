import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://buddget.online', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://buddget.online/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://buddget.online/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://buddget.online/install', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]
}
