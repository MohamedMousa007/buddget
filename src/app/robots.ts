import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // '/$' is an exact-match anchor: the homepage only, not every path under it.
        // The second line is what those pages load: crawlers need it to render them and to show share images.
        allow: ['/$', '/en', '/ar', '/terms', '/privacy', '/legal/terms', '/legal/privacy', '/llms.txt',
          '/_next/', '/site/', '/icons/', '/og-', '/favicon.ico'],
        disallow: '/',
      },
    ],
    sitemap: 'https://buddget.app/sitemap.xml',
    host: 'https://buddget.app',
  }
}
