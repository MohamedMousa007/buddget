import type { Metadata, Viewport } from 'next'
import { siteFontClasses } from '@/lib/site/fonts'
import { SITE_URL } from '@/lib/site/config'
import { SITE_THEME_SCRIPT } from '@/lib/site/theme'
import '../globals.css'
import '@/components/site/site.css'
import '@/components/site/home.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Buddget', template: '%s | Buddget' },
  applicationName: 'Buddget',
  authors: [{ name: 'Buddget', url: SITE_URL }],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = { themeColor: '#12B0A0', width: 'device-width', initialScale: 1 }

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-locale="ar" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: SITE_THEME_SCRIPT }} /></head>
      <body className={`${siteFontClasses} bg-brand-bg font-sans text-brand-text-primary antialiased`}>{children}</body>
    </html>
  )
}
