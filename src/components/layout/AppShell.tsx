'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ModalProvider } from '@/components/modals/ModalProvider'
import { OnboardingBanner } from '@/components/layout/OnboardingBanner'
import { SyncFailureBanner } from '@/components/layout/SyncFailureBanner'
import { DesktopHeaderBar } from '@/components/layout/DesktopHeaderBar'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useRates } from '@/hooks/useRates'
import { useGoldPrice } from '@/hooks/useGoldPrice'
import { WidgetSync } from '@/lib/native/WidgetSync'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { isNative } from '@/lib/native/isNative'
import { isAndroid } from '@/lib/native/isNative'

/**
 * Re-registers the Capacitor SMS listener on every app startup.
 *
 * Problem: `startSMSTracking()` is normally called from `useSmsTracking.toggle()`,
 * which only fires when the user changes the switch. After a restart the Zustand
 * store hydrates with `smsTrackingEnabled: true` but the module-level
 * `listenerAttached` variable resets to `false`, so no listener is registered and
 * incoming SMS events go unheard — even with the app in the foreground.
 *
 * `startSMSTracking` is idempotent: it returns early if `listenerAttached` is
 * already true, so it's safe to call on every mount.
 */
function SmsStartupSync() {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  useEffect(() => {
    if (!smsEnabled || !isNative() || !isAndroid()) return
    void (async () => {
      const [{ startSMSTracking }, { createClient }] = await Promise.all([
        import('@/lib/native/smsTracker'),
        import('@/lib/supabase/client'),
      ])
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token ?? ''
      if (token) await startSMSTracking(token)
    })()
  }, [smsEnabled])
  return null
}

/** Keeps FX + gold spot in sync for all main app routes (not auth/onboarding). */
function MarketRatesSync() {
  useRates()
  useGoldPrice()
  return null
}

interface AppShellProps {
  children: React.ReactNode
}

function isBareAuthRoute(pathname: string | null) {
  if (!pathname) return false
  if (pathname.startsWith('/reset-password')) return true
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) return true
  return false
}

export function AppShell({ children }: AppShellProps) {
  useThemeSync()
  const pathname = usePathname()
  const bare = isBareAuthRoute(pathname)

  if (bare) {
    return (
      <div className="min-h-screen bg-[var(--color-brand-bg)]">
        {children}
        <ModalProvider />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] no-tap-highlight">
      <MarketRatesSync />
      <Sidebar />
      <DesktopHeaderBar />
      <main className="native-scroll pt-[calc(3rem+env(safe-area-inset-top,0px))] lg:pt-12 lg:ms-[176px] pb-16 lg:pb-0 min-h-screen safe-area-x">
        <OnboardingBanner />
        <SyncFailureBanner />
        {children}
      </main>
      <BottomNav />
      <ModalProvider />
      <WidgetSync />
      <SmsStartupSync />
    </div>
  )
}
