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
      const { startSMSTracking, saveSmsToken } = await import('@/lib/native/smsTracker')
      await startSMSTracking(token)
      // Replace the 1-hour Supabase JWT with the permanent ingest token.
      // Without this, WorkManager silently gets 401 after the JWT expires and
      // every SMS is dropped with no DB row, no error, no notification.
      try {
        const res = await fetch(apiUrl('/api/sms/setup-token'), {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = (await res.json()) as { token?: string }
          if (data.token) await saveSmsToken(data.token)
        }
      } catch { /* non-fatal — JWT fallback already in SharedPreferences */ }
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
 * addExpense/addIncomeSource append blindly — these guards make SMS-driven
 * store updates idempotent across the realtime INSERT+UPDATE pair and the
 * FCM push handler racing each other for the same row.
 */
function addExpenseIfMissing(row: ExpenseRow): void {
  // Ingest the server row VERBATIM (real id, timestamps). Routing through
  // addExpense would regenerate the id, duplicating the row on the next flush
  // and breaking dedup. upsertServerExpense keeps the local copy keyed to the
  // server PK so flushDiff stays idempotent.
  useFinanceStore.getState().upsertServerExpense(expenseFromRow(row))
}

function addIncomeIfMissing(row: IncomeSourceRow): void {
  useFinanceStore.getState().upsertServerIncome(incomeSourceFromRow(row))
}

/**
 * Confirms back to the server that an SMS-tracked row actually rendered in the
 * app — the signal that promotes the parse log to status='confirmed'. Without
 * this, a row stays 'logged'/'notified' and is flagged undelivered after 2 min.
 * Fire-and-forget; bearer-authed to match /api/sms/ack.
 */
async function ackSms(logId: string | undefined): Promise<void> {
  if (!logId) return
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch(apiUrl('/api/sms/ack'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ logId }),
    })
  } catch { /* fire-and-forget */ }
}

/**
 * Subscribes to Supabase realtime events on sms_parse_log. The parse route
 * claims a row first (parsed_ok=false) and promotes it via UPDATE once the
 * expense/income exists, so BOTH events are observed and filtered client-side
 * on the presence of a linked id. RLS scopes events to the authenticated user.
 */
function SmsRealtimeSync() {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const dataReady = useFinanceStore((s) => s.dataReady)

  useEffect(() => {
    if (!dataReady || !smsEnabled) return
    const supabase = createClient()
    const onRow = async (payload: { new: { id?: string; expense_id?: string | null; income_id?: string | null } }) => {
      const row = payload.new
      let rendered = false
      if (row.expense_id) {
        const { data } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', row.expense_id)
          .single()
        if (data) { addExpenseIfMissing(data as ExpenseRow); rendered = true }
      }
      if (row.income_id) {
        const { data } = await supabase
          .from('income_sources')
          .select('*')
          .eq('id', row.income_id)
          .single()
        if (data) { addIncomeIfMissing(data as IncomeSourceRow); rendered = true }
      }
      if (rendered) void ackSms(row.id)
    }
    const channel = supabase
      .channel('sms-live')
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'sms_parse_log' },
        onRow,
      )
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'sms_parse_log' },
        onRow,
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [dataReady, smsEnabled])

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
          if (row) { addExpenseIfMissing(row as ExpenseRow); void ackSms(data.logId) }
          router.push(`/expenses?highlight=${data.expenseId}`)
        })()
      } else if (kind === 'sms_income_added' && data.incomeId) {
        void (async () => {
          const supabase = createClient()
          const { data: row } = await supabase.from('income_sources').select('*').eq('id', data.incomeId).single()
          if (row) { addIncomeIfMissing(row as IncomeSourceRow); void ackSms(data.logId) }
          router.push('/income')
        })()
      }
    }
    window.addEventListener('buddget:push-action', handler)
    return () => window.removeEventListener('buddget:push-action', handler)
  }, [router])
  return null
}
