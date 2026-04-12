import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** Persisted localStorage keys used by Zustand and related client caches. */
const STORAGE_KEYS = [
  'buddget-storage',
  'buddget-ui-settings',
  'buddget-notifications-read',
  'buddget-pwa-install-banner-dismissed-at',
  'pwa-install-dismissed',
] as const

/**
 * Wipe persisted client data and reset in-memory Zustand state.
 * Safe to call multiple times (e.g. sign-out handler + `SIGNED_OUT` listener).
 * Call before `supabase.auth.signOut()` when possible; still sign out if this throws.
 */
export function clearBudgetData(): void {
  for (const key of STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* SSR or restricted storage */
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
