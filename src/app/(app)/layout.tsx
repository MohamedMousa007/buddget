import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, parseLocaleCookie } from '@/lib/i18n/localeCookie'
import { DM_Sans, JetBrains_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google'
import '../globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { LocaleProvider } from '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UpdatePrompt } from '@/components/ui/UpdatePrompt'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { UpdateGate } from '@/components/ui/UpdateGate'
import { ActionToastProvider } from '@/components/ui/ActionToast'
import { MotionConfigRoot } from '@/components/layout/MotionConfigRoot'
import { THEME_INIT_SCRIPT } from '@/lib/theme/applyTheme'
import { PlatformBodyClass } from '@/lib/native/PlatformBodyClass'
import { NativeInviteLinks } from '@/lib/native/inviteLinks'
import { CrashReporter } from '@/lib/crash/CrashReporter'

// One variable-weight file serves body and headings (was 8 static weight files).
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
})

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-sans-ar',
  weight: ['400', '500', '600', '700'],
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL('https://buddget.app'),
  title: {
    default: 'buddget — Personal Finance Tracker & Budget Planner',
    template: '%s | buddget',
  },
  description:
    'Track expenses, manage budgets, monitor debts and savings. Free personal finance tracker. Works on iPhone and Android. Supports AED, USD, EGP and 10+ currencies.',
  keywords: [
    'budget planner',
    'expense tracker',
    'personal finance app',
    'money tracker',
    'budget app UAE',
    'AED budget tracker',
    'multi currency budget',
    'debt tracker',
    'savings tracker',
    'free budget app',
    'expat finance UAE',
    'gold debt tracker',
    'budget planner Dubai',
    'expense manager',
  ],
  authors: [{ name: 'buddget', url: 'https://buddget.app' }],
  creator: 'buddget',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://buddget.app',
    siteName: 'buddget',
    title: 'buddget — Personal Finance Tracker & Budget Planner',
    description: 'Track expenses, manage budgets, monitor debts. Free multi-currency planner.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'buddget — Personal Finance Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'buddget — Personal Finance Tracker',
    description: 'Track expenses, manage budgets, monitor debts. Free multi-currency planner.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: 'https://buddget.app' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'buddget',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#12B0A0',
  width: 'device-width',
  initialScale: 1,
  /** Edge-to-edge in installed PWA / iOS; pairs with `env(safe-area-inset-*)` in layout. */
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce =
    process.env.CAPACITOR === 'true' ? undefined : ((await headers()).get('x-nonce') ?? undefined)

  const locale = process.env.CAPACITOR === 'true' ? 'en' : parseLocaleCookie((await cookies()).get(LOCALE_COOKIE)?.value)

  return (
    <html lang={locale} dir="ltr" data-locale={locale} translate="no" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icons/icon-48.png" type="image/png" sizes="48x48" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="buddget" />
      </head>
      <body
        style={{ '--font-heading': 'var(--font-sans)' } as React.CSSProperties}
        className={`${dmSans.variable} ${jetbrainsMono.variable} ${ibmPlexArabic.variable} font-sans antialiased`}
      >
        <PlatformBodyClass />
        <NativeInviteLinks />
        <TooltipProvider>
          <LocaleProvider>
            <ActionToastProvider>
              <AuthProvider>
                <CrashReporter />
                <MotionConfigRoot>
                  <AppShell>{children}</AppShell>
                  <UpdatePrompt />
                  <OfflineBanner />
                  <UpdateGate />
                </MotionConfigRoot>
              </AuthProvider>
            </ActionToastProvider>
          </LocaleProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
