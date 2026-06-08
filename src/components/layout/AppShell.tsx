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
 * Re-registers the Capacitor SMS listener on every app startup and on auth changes.
 *
 * Two failure modes solved:
 * 1. Restart: `listenerAttached` resets to false → no listener registered.
 *    Fixed by running on mount and calling startSMSTracking (idempotent guard inside).
 * 2. Fresh install / re-login: `smsEnabled` stays true but token never saved
 *    to SharedPreferences → WorkManager path dead.
 *    Fixed by listening to SIGNED_IN auth event.
 * 3. Token expiry (JWT expires in 1h): stored token goes stale.
 *    Fixed by listening to TOKEN_REFRESHED and calling refreshSmsToken.
 */
function SmsStartupSync() {
  useEffect(() => {
    if (!isNative() || !isAndroid()) return

    const smsEnabled = () => useFinanceStore.getState().settings.smsTrackingEnabled

    const tryStart = async (token: string) => {
      if (!smsEnabled() || !token) return
      const { startSMSTracking } = await import('@/lib/native/smsTracker')
      await startSMSTracking(token)
    }

    const tryRefresh = async (token: string) => {
      if (!smsEnabled() || !token) return
      const { refreshSmsToken } = await import('@/lib/native/smsTracker')
      await refreshSmsToken(token)
    }

    let unsub: (() => void) | null = null
    void (async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const client = createClient()
      // Initial mount — handles re-launch while already logged in
      const { data } = await client.auth.getSession()
      void tryStart(data.session?.access_token ?? '')
      // Auth state changes — handles login after fresh install + token refresh
      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        const token = session?.access_token ?? ''
        if (event === 'SIGNED_IN') void tryStart(token)
        if (event === 'TOKEN_REFRESHED') void tryRefresh(token)
      })
      unsub = listener.subscription.unsubscribe
    })()

    return () => { unsub?.() }
  }, []) // mount only — auth listener covers the rest
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
