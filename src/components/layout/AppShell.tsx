'use client'

import { Suspense, lazy, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AppViewRouter } from './AppViewRouter'
import { PullToRefresh } from './PullToRefresh'
import { RouteAnnouncer } from './RouteAnnouncer'
import { SkipLink } from './SkipLink'
import { MAIN_ID } from './routeAnnounce'
import { navigate } from '@/lib/navigation/navigate'
import { useNavPath, bindPopState } from '@/lib/navigation/navStore'
import { ModalProvider } from '@/components/modals/ModalProvider'
import { SyncFailureBanner } from '@/components/layout/SyncFailureBanner'
import { PendingCapturesChip } from '@/components/features/pending/PendingCapturesChip'
import { BannerStack } from '@/components/features/dashboard/BannerStack'
import { SmsReviewChip } from '@/components/features/dashboard/SmsReviewChip'
import { SmsAccountDetectionBanner } from '@/components/features/dashboard/SmsAccountDetectionBanner'
import { UnplacedSmsPrompt } from '@/components/features/dashboard/UnplacedSmsPrompt'
import { SmsSubscriptionDetectionBanner } from '@/components/features/dashboard/SmsSubscriptionDetectionBanner'
import { SubscriptionPlanChangeBanner } from '@/components/features/dashboard/SubscriptionPlanChangeBanner'
import { ownsHeader } from '@/lib/navigation/ownsHeader'
import { DesktopHeaderBar } from '@/components/layout/DesktopHeaderBar'
import { OnboardingGate } from '@/components/features/onboarding/OnboardingGate'
import { useThemeSync } from '@/hooks/useThemeSync'
import { useRates } from '@/hooks/useRates'
import { useCycleAwareMonth } from '@/hooks/useCycleAwareMonth'
import { useGoldPrice } from '@/hooks/useGoldPrice'
import { subscribePushActions } from '@/lib/native/pushActionQueue'
import { SMS_REVIEW_PUSH_KINDS } from '@/lib/sms/pushKinds'
import { routeForNotifType } from '@/lib/notifications/pushRoute'
import { requestSmsReview } from '@/lib/sms/reviewRequest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useExpenseFilterStore } from '@/lib/store/useExpenseFilterStore'
import { isNative } from '@/lib/native/isNative'
import { isAndroid } from '@/lib/native/isNative'
import { runBackGuards } from '@/lib/navigation/backGuard'
import { useActionToast } from '@/components/ui/ActionToast'
import { StorageQuotaToast } from '@/components/layout/StorageQuotaToast'
import { useT } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import { syncFinanceNow } from '@/components/sync/SupabaseFinanceSync'

const AdminApp = lazy(() => import('@/components/features/admin/AdminApp').then((m) => ({ default: m.AdminApp })))

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
      // Every phone checks in (a phone that does not collect texts still belongs in the devices list).
      void import('@/lib/devices/client').then((m) => m.sendDeviceHeartbeat(userId, status?.enabled ?? false))
      // No Shortcut/receiver physically on this device → nothing to arm or drain.
      if (!status?.wired && !status?.needsResync) return

      // 2. Reconcile armed-state to the account's remembered intent — this is what
      //    makes on/off follow the ACCOUNT across sign-out/in: A stays armed, B
      //    starts off, A auto-resumes on return. Online-only (both reads need the
      //    network); offline leaves current device state as-is.
      if ((refreshToken || status?.needsResync || !status?.tokenSaved) && isOnline()) {
        // This phone's own role first (another phone turning tracking off must not disarm it); the account setting only
        // decides for a phone the server has not met yet.
        const { fetchDeviceCollectsSms } = await import('@/lib/devices/client')
        const intent = (await fetchDeviceCollectsSms()) ?? (await fetchAccountSmsIntent(userId))
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

    let cancelled = false
    let unsub: (() => void) | null = null
    let removeResume: (() => void) | null = null
    void (async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const client = createClient()
      // Initial mount — handles re-launch while already logged in
      const { data } = await client.auth.getSession()
      if (cancelled) return
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
      if (cancelled) { unsub?.(); return }
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return
        void (async () => {
          const { data: s } = await client.auth.getSession()
          void tryStart(s.session?.access_token ?? '', s.session?.user?.id ?? '', false)
        })()
      })
      if (cancelled) { void handle.remove(); return }
      removeResume = () => { void handle.remove() }
    })()

    return () => { cancelled = true; unsub?.(); removeResume?.() }
  }, []) // mount only — auth + resume listeners cover the rest
  return null
}

/**
 * Instant SMS updates. The server nudges the user's private channel when a message has been parsed and saved; one small
 * delta pull (flush, pull what changed, re-baseline) brings the new transaction in. No change-feed subscription and no
 * per-row fetches. A missed nudge is covered by the push notification and by the pull on open and resume.
 */
function SmsNudgeSync() {
  const smsEnabled = useFinanceStore((s) => s.settings.smsTrackingEnabled)
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { user } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    if (!dataReady || !smsEnabled || !userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`user:${userId}`, { config: { private: true } })
      .on('broadcast', { event: 'sms' }, () => { void syncFinanceNow().catch(() => undefined) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [dataReady, smsEnabled, userId])

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
      const added = await App.addListener('backButton', ({ canGoBack }) => {
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
      if (cancelled) void added.remove()
      else handle = added
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

const BARE_ROUTES = ['/reset-password', '/legal', '/offline', '/install', '/admin']

/** Routes that render without sidebar, headers, FAB or bottom nav. */
function isBareAuthRoute(pathname: string | null) {
  if (!pathname) return false
  return BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`) || (r === '/reset-password' && pathname.startsWith(r)))
}

function isAdminRoute(pathname: string | null) {
  return pathname === '/admin' || !!pathname?.startsWith('/admin/')
}

export function AppShell({ children }: AppShellProps) {
  useThemeSync()
  useCycleAwareMonth()
  const pathname = usePathname()
  const navPath = useNavPath()
  // The admin host serves the portal at its root, which the browser still reports as "/".
  const shellPath = navPath === '/admin' ? '/admin' : pathname
  const bare = isBareAuthRoute(shellPath)

  // Keep the in-memory shell in sync with browser back/forward + iOS swipe-back.
  useEffect(() => bindPopState(), [])

  if (bare) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-brand-bg)]">
        {shellPath === '/admin' ? <Suspense fallback={null}><AdminApp /></Suspense> : children}
        {/* The portal builds its own dialogs; the consumer add-expense FAB has no place in it. */}
        {!isAdminRoute(shellPath) ? <ModalProvider /> : null}
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-brand-bg)] no-tap-highlight">
      <MarketRatesSync />
      <SkipLink />
      <RouteAnnouncer />
      <Sidebar />
      <DesktopHeaderBar />
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className={`outline-none native-scroll ${ownsHeader(navPath) ? 'pt-[env(safe-area-inset-top,0px)]' : 'pt-[calc(var(--app-header-h)+env(safe-area-inset-top,0px))]'} lg:pt-[var(--app-header-h-lg)] lg:ms-[var(--sidebar-w)] pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-24 min-h-[100dvh] safe-area-x`}
      >
        <PullToRefresh>
          <PendingCapturesChip />
          <AppViewRouter>{children}</AppViewRouter>
        </PullToRefresh>
      </main>
      {/* One drop-down stack for every question; the sources register into it. */}
      <SmsReviewChip />
      <SmsAccountDetectionBanner />
      <UnplacedSmsPrompt />
      <SmsSubscriptionDetectionBanner />
      <SubscriptionPlanChangeBanner />
      <BannerStack />
      <SyncFailureBanner />
      <BottomNav />
      <ModalProvider />
      <SmsStartupSync />
      <OnboardingGate />
      <SmsNudgeSync />
      <SmsPushActionHandler />
      <AndroidBackHandler />
      <StorageQuotaToast />
    </div>
  )
}

const withTimeout = (p: Promise<unknown>, ms: number): Promise<unknown> =>
  Promise.race([p.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, ms))])

/**
 * Routes native FCM push taps (queued by pushNotifications.ts, replayed once this mounts) and routes the user to the correct screen.
 * Renders nothing — side-effect only.
 */
function SmsPushActionHandler() {
  useEffect(() => {
    if (!isNative()) return
    const handler = (detail: unknown): void => {
      const data = (
        (detail as { notification?: { data?: Record<string, string> } } | undefined)
          ?.notification?.data ?? {}
      )
      const kind = data.kind
      if (kind && SMS_REVIEW_PUSH_KINDS.has(kind)) {
        // Held or failed adds are reviewed in the sheet; a body tap must never book a transaction.
        requestSmsReview()
        navigate('/')
      } else if (
        (kind === 'sms_auto_added' ||
          kind === 'sms_transfer' ||
          kind === 'sms_atm' ||
          kind === 'sms_subscription' ||
          kind === 'sms_currency_confirm' ||
          kind === 'sms_cc_payoff') &&
        data.expenseId
      ) {
        // The transaction may have been created while the app was in the background: pull what changed so it is in the
        // store before the list opens (bounded, so a slow network never holds the tap).
        void withTimeout(syncFinanceNow(), 2500).finally(() => navigate(kind === 'sms_cc_payoff' ? '/debts' : '/flow'))
      } else if (kind === 'sms_cc_payoff') {
        // Ambiguous CC payoff posted no expense id — just open debts.
        navigate('/debts')
      } else if (kind === 'sms_income_added' && data.incomeId) {
        void withTimeout(syncFinanceNow(), 2500).finally(() => {
          useExpenseFilterStore.getState().setSegment('in')
          navigate('/flow')
        })
      } else if (kind === 'sms_salary_matched') {
        // No row created (matched to declared salary) — open income.
        navigate('/paydays')
      } else if (kind === 'notification') {
        const route = routeForNotifType(data.notifType)
        if (route) navigate(route)
      }
    }
    return subscribePushActions(handler as (action: unknown) => void)
  }, [])
  return null
}
