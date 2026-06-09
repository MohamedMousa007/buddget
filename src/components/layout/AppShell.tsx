'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiUrl } from '@/lib/apiBase'
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
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { incomeSourceFromRow } from '@/lib/supabase/remote/mappers/incomeSourceMapper'
import { createClient } from '@/lib/supabase/client'
import type { ExpenseRow } from '@/lib/supabase/remote/types'
import type { IncomeSourceRow } from '@/lib/supabase/remote/types'

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

/**
 * Subscribes to Supabase realtime INSERT events on sms_parse_log (filtered to
 * parsed_ok=true). When a new SMS transaction lands — whether the app was in the
 * foreground or WorkManager synced it from the background — the corresponding
 * expense or income is immediately added to the Zustand store so the dashboard
 * updates without any user interaction.
 * RLS on the table scopes events to the authenticated user automatically.
 */
function SmsRealtimeSync() {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const addIncomeSource = useFinanceStore((s) => s.addIncomeSource)

  useEffect(() => {
    if (!smsEnabled) return
    const supabase = createClient()
    const channel = supabase
      .channel('sms-live')
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'sms_parse_log', filter: 'parsed_ok=eq.true' },
        async (payload: { new: { expense_id?: string | null; income_id?: string | null } }) => {
          const row = payload.new
          if (row.expense_id) {
            const { data } = await supabase
              .from('expenses')
              .select('*')
              .eq('id', row.expense_id)
              .single()
            if (data) addExpense(expenseFromRow(data as ExpenseRow))
          }
          if (row.income_id) {
            const { data } = await supabase
              .from('income_sources')
              .select('*')
              .eq('id', row.income_id)
              .single()
            if (data) addIncomeSource(incomeSourceFromRow(data as IncomeSourceRow))
          }
        },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [smsEnabled, addExpense, addIncomeSource])

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
      <SmsRealtimeSync />
      <SmsPushActionHandler />
    </div>
  )
}

/**
 * Listens for native FCM push tap events (dispatched by pushNotifications.ts as
 * `buddget:push-action`) and routes the user to the correct screen.
 * Renders nothing — side-effect only.
 */
function SmsPushActionHandler() {
  const router = useRouter()
  useEffect(() => {
    if (!isNative()) return
    const handler = (e: Event): void => {
      const data = (
        ((e as CustomEvent).detail as { notification?: { data?: Record<string, string> } } | undefined)
          ?.notification?.data ?? {}
      )
      const kind = data.kind
      if (kind === 'sms_confirm' && data.hash) {
        void fetch(apiUrl('/api/sms/confirm'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash: data.hash }),
        })
          .then((r) => r.json())
          .then((res: { expenseId?: string }) => {
            router.push(res.expenseId ? `/expenses?highlight=${res.expenseId}` : '/')
          })
          .catch(() => router.push('/'))
      } else if (kind === 'sms_auto_added' && data.expenseId) {
        // Ensure the expense is in the store before navigating (WorkManager may
        // have created it while the app was in the background — realtime subscription
        // might have missed it if the channel wasn't open yet).
        void (async () => {
          const supabase = createClient()
          const { data: row } = await supabase.from('expenses').select('*').eq('id', data.expenseId).single()
          if (row) useFinanceStore.getState().addExpense(expenseFromRow(row as ExpenseRow))
          router.push(`/expenses?highlight=${data.expenseId}`)
        })()
      } else if (kind === 'sms_income_added' && data.incomeId) {
        void (async () => {
          const supabase = createClient()
          const { data: row } = await supabase.from('income_sources').select('*').eq('id', data.incomeId).single()
          if (row) useFinanceStore.getState().addIncomeSource(incomeSourceFromRow(row as IncomeSourceRow))
          router.push('/income')
        })()
      }
    }
    window.addEventListener('buddget:push-action', handler)
    return () => window.removeEventListener('buddget:push-action', handler)
  }, [router])
  return null
}
