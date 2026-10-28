import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // '/$' is an exact-match anchor: the homepage only, not every path under it.
        allow: ['/$', '/en', '/ar', '/terms', '/privacy', '/legal/terms', '/legal/privacy', '/llms.txt'],
        disallow: '/',
      },
    ],
    sitemap: 'https://buddget.app/sitemap.xml',
    host: 'https://buddget.app',
  }
}
