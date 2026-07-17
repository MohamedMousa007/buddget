'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { apiUrl } from '@/lib/apiBase'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AppViewRouter } from './AppViewRouter'
import { PullToRefresh } from './PullToRefresh'
import { navigate } from '@/lib/navigation/navigate'
import { useNavPath, bindPopState } from '@/lib/navigation/navStore'
import { ModalProvider } from '@/components/modals/ModalProvider'
import { SyncFailureBanner } from '@/components/layout/SyncFailureBanner'
import { PendingCapturesChip } from '@/components/features/pending/PendingCapturesChip'
import { PendingSmsCards } from '@/components/features/pending/PendingSmsCards'
import { DesktopHeaderBar } from '@/components/layout/DesktopHeaderBar'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useRates } from '@/hooks/useRates'
import { useGoldPrice } from '@/hooks/useGoldPrice'
import { WidgetSync } from '@/lib/native/WidgetSync'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { isNative } from '@/lib/native/isNative'
import { isAndroid } from '@/lib/native/isNative'
import { runBackGuards } from '@/lib/navigation/backGuard'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { incomeEventFromRow } from '@/lib/supabase/remote/mappers/incomeEventMapper'
import { debtPaymentFromRow } from '@/lib/supabase/remote/mappers/debtPaymentMapper'
import { createClient } from '@/lib/supabase/client'
import type { ExpenseRow } from '@/lib/supabase/remote/types'
import type { IncomeEventRow } from '@/lib/supabase/remote/types'
import type { DebtPaymentRow } from '@/lib/supabase/remote/types'

/**
 * Fires on every native app startup and on auth changes. Handles two platforms:
 *
 * Android: refreshes the non-expiring ingest token (the ONLY credential ever
 *   written to SharedPreferences — a stored JWT would expire in ~1h and every
 *   later SMS POST would 401 and be silently dropped).
 *
 * iOS: drains the pending queue that CatchBankSmsIntent writes for EVERY caught
 *   SMS up front (not just offline ones — the intent can be killed mid-send, so
 *   the queue is the durability guarantee and delivery merely removes entries).
 *   Each queued message is re-submitted to /api/sms/parse with the current
 *   session JWT; the server dedupes by sms_hash, so replaying a message that
 *   actually landed is harmless.
 */
function SmsStartupSync() {
  useEffect(() => {
    if (!isNative()) return

    // refreshToken=false on resume: ensureIngestToken is a network round-trip with
    // retries, and the token never expires — refreshing it on every foreground buys
    // nothing. The drain itself is free when the queue is empty.
    // Server-side account intent (user_settings.sms_tracking_enabled) — the
    // authoritative "does this account want tracking". Read from the server, not
    // the store, so it's correct even before the store rehydrates on cold start.
    // null on read failure ⇒ leave device state untouched (never disarm a working
    // device over a transient hiccup).
    const fetchAccountSmsIntent = async (userId: string): Promise<boolean | null> => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const { data, error } = await createClient()
          .from('user_settings')
          .select('sms_tracking_enabled')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return null
        return Boolean((data as { sms_tracking_enabled?: boolean } | null)?.sms_tracking_enabled)
      } catch {
        return null
      }
    }

    // refreshToken=false on resume: skip the account-intent reconcile (a network
    // round-trip) — resume never changes accounts, and the token never expires.
    const tryStart = async (token: string, userId: string, refreshToken = true) => {
      if (!token || !userId) return
      const { getSmsBridgeStatus, ensureIngestToken, drainAndSubmitPendingSms, reconcileSmsOwner, setSmsEnabled } =
        await import('@/lib/native/smsTracker')
      const { isOnline } = await import('@/hooks/useNetworkStatus')

      // 1. Account-switch guard FIRST (no network): if the stored ingest token
      //    belongs to a previous account, drop it + disarm before any SMS can be
      //    forwarded into the wrong account. Keeps the device capability intact.
      await reconcileSmsOwner(userId)

      const status = await getSmsBridgeStatus()
      // No Shortcut/receiver physically on this device → nothing to arm or drain.
      if (!status?.wired) return

      // 2. Reconcile armed-state to the account's remembered intent — this is what
      //    makes on/off follow the ACCOUNT across sign-out/in: A stays armed, B
      //    starts off, A auto-resumes on return. Online-only (both reads need the
      //    network); offline leaves current device state as-is.
      if (refreshToken && isOnline()) {
        const intent = await fetchAccountSmsIntent(userId)
        if (intent === true) {
          // ensureIngestToken re-stamps the token to this account (self-heal).
          if (await ensureIngestToken(token, userId)) await setSmsEnabled(true)
        } else if (intent === false) {
          await setSmsEnabled(false)
        }
        // intent === null (read failed): leave device state untouched.
      }

      // 3. Replay SMS this account captured offline (owner-filtered inside). NOT
      //    gated on `enabled` — SMS queued before the user disabled tracking must
      //    still reach the server. Skip while offline — items stay queued.
      if (!isOnline()) return
      await drainAndSubmitPendingSms(token, userId)
    }

    let unsub: (() => void) | null = null
    let removeResume: (() => void) | null = null
    void (async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const client = createClient()
      // Initial mount — handles re-launch while already logged in
      const { data } = await client.auth.getSession()
      void tryStart(data.session?.access_token ?? '', data.session?.user?.id ?? '')
      // Auth state changes — handles login after fresh install / account switch
      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') void tryStart(session?.access_token ?? '', session?.user?.id ?? '')
      })
      unsub = listener.subscription.unsubscribe

      // Resume — the SMS automation background-launches the app to run the intent,
      // which can leave the process alive with a queued SMS. Bringing the app
      // forward then never remounts, so mount+SIGNED_IN alone would strand it
      // until the next cold start.
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        void (async () => {
          const { data: s } = await client.auth.getSession()
          void tryStart(s.session?.access_token ?? '', s.session?.user?.id ?? '', false)
        })()
      })
      removeResume = () => { void handle.remove() }
    })()

    return () => { unsub?.(); removeResume?.() }
  }, []) // mount only — auth + resume listeners cover the rest
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

function addIncomeEventIfMissing(row: IncomeEventRow): void {
  useFinanceStore.getState().upsertServerIncomeEvent(incomeEventFromRow(row))
}

function addDebtPaymentIfMissing(row: DebtPaymentRow): void {
  useFinanceStore.getState().upsertServerDebtPayment(debtPaymentFromRow(row))
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
    const onRow = async (payload: { new: { id?: string; expense_id?: string | null; income_id?: string | null; debt_payment_id?: string | null; awaiting_confirmation?: boolean } }) => {
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
          .from('income_events')
          .select('*')
          .eq('id', row.income_id)
          .single()
        if (data) { addIncomeEventIfMissing(data as IncomeEventRow); rendered = true }
      }
      if (row.debt_payment_id) {
        // CC payoff: pull the debt payment so the card balance updates live.
        const { data } = await supabase
          .from('debt_payments')
          .select('*')
          .eq('id', row.debt_payment_id)
          .single()
        if (data) { addDebtPaymentIfMissing(data as DebtPaymentRow); rendered = true }
      }
      // Skip ack for rows still awaiting user action (currency_provisional, add_failed).
      // sms_mark_acked sets status='confirmed' without clearing awaiting_confirmation,
      // which permanently traps those rows in the SMS review sheet.
      if (rendered && !row.awaiting_confirmation) void ackSms(row.id)
    }

    // ponytail: catch-up ack — rows processed while app was closed/backgrounded
    // never fire a realtime event the subscription can see, so they stay 'logged'
    // or 'notified' forever. On mount, ack any such rows that already have a
    // linked transaction (expense/income/debt_payment).
    void (async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: pending } = await supabase
        .from('sms_parse_log')
        .select('id')
        .in('status', ['logged', 'notified'])
        .eq('awaiting_confirmation', false)
        .or('expense_id.not.is.null,income_id.not.is.null,debt_payment_id.not.is.null')
        .gte('received_at', cutoff)
        .limit(50)
      for (const row of pending ?? []) void ackSms(row.id)
    })()

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

/**
 * Handles Android hardware back button: closes open modals, lets registered
 * back guards intercept (e.g. unsaved-changes dialogs), steps back through
 * webview history from inner screens, and shows a "press again to exit" toast
 * on Dashboard before calling App.exitApp() on the second press within 2 s.
 */
function AndroidBackHandler() {
  const activeModal = useSettingsStore((s) => s.activeModal)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const pathname = useNavPath()
  const showToast = useActionToast()
  const t = useT()
  const exitPending = useRef(false)

  // Keep fresh values in refs so we never need to re-register the listener
  const activeModalRef = useRef(activeModal)
  const setActiveModalRef = useRef(setActiveModal)
  const pathnameRef = useRef(pathname)
  const showToastRef = useRef(showToast)
  const tRef = useRef(t)

  useEffect(() => { activeModalRef.current = activeModal }, [activeModal])
  useEffect(() => { pathnameRef.current = pathname }, [pathname])
  useEffect(() => { showToastRef.current = showToast }, [showToast])
  useEffect(() => { tRef.current = t }, [t])

  useEffect(() => {
    if (!isAndroid()) return
    let cancelled = false
    let handle: { remove: () => Promise<void> } | null = null
    void (async () => {
      const { App } = await import('@capacitor/app')
      if (cancelled) return
      handle = await App.addListener('backButton', ({ canGoBack }) => {
        // Guards first: inner dismissable layers (number pad, unsaved-changes
        // dialogs) must consume the back press before the modal itself closes.
        if (runBackGuards()) return
        if (activeModalRef.current) {
          setActiveModalRef.current(null)
          return
        }
        if (pathnameRef.current !== '/') {
          if (canGoBack) window.history.back()
          else navigate('/')
          return
        }
        if (exitPending.current) {
          void App.exitApp()
          return
        }
        exitPending.current = true
        showToastRef.current(tRef.current.common.pressBackAgainToExit)
        window.setTimeout(() => { exitPending.current = false }, 2000)
      })
    })()
    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, []) // mount only — refs keep values current

  return null
}

interface AppShellProps {
  children: React.ReactNode
}

function isBareAuthRoute(pathname: string | null) {
  if (!pathname) return false
  return pathname.startsWith('/reset-password')
}

export function AppShell({ children }: AppShellProps) {
  useThemeSync()
  const pathname = usePathname()
  const bare = isBareAuthRoute(pathname)

  // Keep the in-memory shell in sync with browser back/forward + iOS swipe-back.
  useEffect(() => bindPopState(), [])

  if (bare) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-brand-bg)]">
        {children}
        <ModalProvider />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-brand-bg)] no-tap-highlight">
      <MarketRatesSync />
      <Sidebar />
      <DesktopHeaderBar />
      <main className="native-scroll pt-[calc(52px+env(safe-area-inset-top,0px))] lg:pt-12 lg:ms-[176px] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0 min-h-[100dvh] safe-area-x">
        <PullToRefresh>
          <SyncFailureBanner />
          <PendingCapturesChip />
          <PendingSmsCards />
          <AppViewRouter>{children}</AppViewRouter>
        </PullToRefresh>
      </main>
      <BottomNav />
      <ModalProvider />
      <WidgetSync />
      <SmsStartupSync />
      <SmsRealtimeSync />
      <SmsPushActionHandler />
      <AndroidBackHandler />
    </div>
  )
}

/**
 * Listens for native FCM push tap events (dispatched by pushNotifications.ts as
 * `buddget:push-action`) and routes the user to the correct screen.
 * Renders nothing — side-effect only.
 */
function SmsPushActionHandler() {
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
            navigate(res.expenseId ? `/expenses?highlight=${res.expenseId}` : '/')
          })
          .catch(() => navigate('/'))
      } else if (
        (kind === 'sms_auto_added' ||
          kind === 'sms_transfer' ||
          kind === 'sms_atm' ||
          kind === 'sms_subscription' ||
          kind === 'sms_currency_confirm' ||
          kind === 'sms_cc_payoff') &&
        data.expenseId
      ) {
        // Ensure the expense is in the store before navigating (WorkManager may
        // have created it while the app was in the background — realtime subscription
        // might have missed it if the channel wasn't open yet).
        void (async () => {
          const supabase = createClient()
          // `.is('deleted_at', null)`: a tombstoned row must never re-enter the store —
          // the next flushDiff would upsert it back and un-delete it server-side.
          const { data: row } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', data.expenseId)
            .is('deleted_at', null)
            .maybeSingle()
          if (row) {
            addExpenseIfMissing(row as ExpenseRow)
            // sms_currency_confirm: currency still needs user confirmation in-app — don't ack yet.
            if (kind !== 'sms_currency_confirm') void ackSms(data.logId)
          }
          // CC payoff also affects the debt ledger — send the user there.
          navigate(kind === 'sms_cc_payoff' ? '/debts' : `/expenses?highlight=${data.expenseId}`)
        })()
      } else if (kind === 'sms_cc_payoff') {
        // Ambiguous CC payoff posted no expense id — just open debts.
        void ackSms(data.logId)
        navigate('/debts')
      } else if (kind === 'sms_income_added' && data.incomeId) {
        void (async () => {
          const supabase = createClient()
          const { data: row } = await supabase
            .from('income_events')
            .select('*')
            .eq('id', data.incomeId)
            .is('deleted_at', null)
            .maybeSingle()
          if (row) { addIncomeEventIfMissing(row as IncomeEventRow); void ackSms(data.logId) }
          navigate('/income')
        })()
      } else if (kind === 'sms_salary_matched') {
        // No row created (matched to declared salary) — acknowledge + open income.
        void ackSms(data.logId)
        navigate('/income')
      }
    }
    window.addEventListener('buddget:push-action', handler)
    return () => window.removeEventListener('buddget:push-action', handler)
  }, [])
  return null
}
