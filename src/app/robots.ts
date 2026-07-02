import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/expenses',
          '/debts',
          '/reports',
          '/settings',
          '/admin',
          '/api/',
          '/profile',
          '/savings',
          '/income',
        ],
      },
    ],
    sitemap: 'https://buddget.app/sitemap.xml',
    host: 'https://buddget.app',
  }
}
