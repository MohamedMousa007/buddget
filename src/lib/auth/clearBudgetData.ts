import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Persisted storage keys used by Zustand and related client caches, plus the
 * guest-session markers written by `AuthProvider.startGuest`. We sweep the list
 * across BOTH localStorage and sessionStorage so sign-out / guest-end leaves no
 * trace regardless of which backend was active.
 */
const STORAGE_KEYS = [
  'buddget-storage',
  'buddget-ui-settings',
  'buddget-notifications-read',
  'buddget-pwa-install-banner-dismissed-at',
  'pwa-install-dismissed',
  // Guest session markers — mirror the names used in src/lib/guest/guestSession.ts.
  'buddget_guest',
  'buddget_guest_nickname',
  'buddget_storage_mode',
] as const

/**
 * Wipe persisted client data and reset in-memory Zustand state.
 * Safe to call multiple times (e.g. sign-out handler + `SIGNED_OUT` listener).
 * Call before `supabase.auth.signOut()` when possible; still sign out if this throws.
 */
export function clearBudgetData(): void {
  if (typeof window !== 'undefined') {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of STORAGE_KEYS) {
        try {
          storage.removeItem(key)
        } catch {
          /* SSR or restricted storage */
        }
      }
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
}
