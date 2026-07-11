import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clearPendingAiJobs } from '@/lib/store/usePendingAiJobs'
import { resetHydrationGuard } from '@/hooks/remote/hydrateGuard'
import { SPLASH_DONE_KEY } from '@/lib/auth/splashLatch'

/**
 * Persisted localStorage keys used by Zustand + misc client caches. Wiped on
 * sign-out so the next visitor doesn't inherit anything. Legacy guest-session
 * keys are included so existing clients clean them up on next sign-out.
 */
const STORAGE_KEYS = [
  'buddget-storage',
  'buddget-ui-settings',
  'buddget-notifications-read',
  'buddget-pending-ai-jobs',
  'buddget-pwa-install-banner-dismissed-at',
  'pwa-install-dismissed',
  'buddget_guest_nickname',
  'buddget_guest_next',
  SPLASH_DONE_KEY,
] as const

/**
 * Wipe persisted client data and reset in-memory Zustand state.
 * Safe to call multiple times (e.g. sign-out handler + `SIGNED_OUT` listener).
 * Call before `supabase.auth.signOut()` when possible; still sign out if this throws.
 */
export function clearBudgetData(): void {
  if (typeof window !== 'undefined') {
    for (const key of STORAGE_KEYS) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* SSR or restricted storage */
      }
    }
    // Belt-and-suspenders: drop any Supabase auth-token keys (sb-<ref>-auth-token,
    // -code-verifier, etc.) so a stale SDK session can never survive a clear and
    // get restored on the next launch. signOut({scope:'local'}) normally does this;
    // this guards the path where it failed or was skipped.
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith('sb-') && k.includes('-auth-token')) window.localStorage.removeItem(k)
      }
    } catch {
      /* restricted storage */
    }
  }

  try {
    useFinanceStore.getState().reset()
  } catch (e) {
    console.error('[clearBudgetData] finance reset failed', e)
  }

  try {
    useSettingsStore.getState().reset()
  } catch (e) {
    console.error('[clearBudgetData] settings reset failed', e)
  }

  // Offline AI captures (voice audio / receipt photos) are per-user — wipe the
  // queue and its on-device media so they never leak to the next account.
  try {
    clearPendingAiJobs()
  } catch (e) {
    console.error('[clearBudgetData] pending AI jobs reset failed', e)
  }

  // Clear the per-userId hydrate dedup guard so the next sign-in hydrates
  // from scratch (rather than short-circuiting based on stale memory).
  try {
    resetHydrationGuard()
  } catch {
    /* no-op */
  }
}
