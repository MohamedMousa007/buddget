import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy', '/legal/terms', '/legal/privacy'],
        disallow: '/',
      },
    ],
    sitemap: 'https://buddget.app/sitemap.xml',
    host: 'https://buddget.app',
  }
}
