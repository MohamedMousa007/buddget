import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { DM_Sans, JetBrains_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { LocaleProvider } from '@/lib/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UpdateToast } from '@/components/ui/UpdateToast'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { ActionToastProvider } from '@/components/ui/ActionToast'
import { TutorialProvider } from '@/components/tutorial/TutorialAnchor'
import { TutorialControllerRoot } from '@/components/tutorial/TutorialController'
import { DebugTourAnchors } from '@/components/tutorial/DebugTourAnchors'
import { DebugTourTrigger } from '@/components/tutorial/DebugTourTrigger'
import { MotionConfigRoot } from '@/components/layout/MotionConfigRoot'
import { THEME_INIT_SCRIPT } from '@/lib/theme/applyTheme'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
})

const dmSansHeading = DM_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
})

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-sans-ar',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://buddget.app'),
  title: {
    default: 'Buddget — Personal Finance Tracker & Budget Planner',
    template: '%s | Buddget',
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
  authors: [{ name: 'Buddget', url: 'https://buddget.app' }],
  creator: 'Buddget',
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
    siteName: 'Buddget',
    title: 'Buddget — Personal Finance Tracker & Budget Planner',
    description: 'Track expenses, manage budgets, monitor debts. Free multi-currency planner.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Buddget — Personal Finance Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buddget — Personal Finance Tracker',
    description: 'Track expenses, manage budgets, monitor debts. Free multi-currency planner.',
    images: ['/opengraph-image'],
  },
  alternates: { canonical: 'https://buddget.app' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Buddget',
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
  themeColor: '#E50914',
  width: 'device-width',
  initialScale: 1,
  /** Edge-to-edge in installed PWA / iOS; pairs with `env(safe-area-inset-*)` in layout. */
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr" data-locale="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icons/icon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Buddget" />
      </head>
      <body
        className={`${dmSans.variable} ${dmSansHeading.variable} ${jetbrainsMono.variable} ${ibmPlexArabic.variable} font-sans antialiased`}
      >
        <TooltipProvider>
          <LocaleProvider>
            <AuthProvider>
              <ActionToastProvider>
                <TutorialProvider>
                  <TutorialControllerRoot>
                    <MotionConfigRoot>
                      <AppShell>{children}</AppShell>
                      <UpdateToast />
                      <OfflineBanner />
                      {process.env.NODE_ENV !== 'production' ? (
                        <>
                          <DebugTourAnchors />
                          <Suspense fallback={null}>
                            <DebugTourTrigger />
                          </Suspense>
                        </>
                      ) : null}
                    </MotionConfigRoot>
                  </TutorialControllerRoot>
                </TutorialProvider>
              </ActionToastProvider>
            </AuthProvider>
          </LocaleProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
