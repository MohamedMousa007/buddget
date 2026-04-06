import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Wipe persisted client data and reset in-memory Zustand state.
 * Call before `supabase.auth.signOut()` (AuthProvider and dropdowns already do).
 * Removes localStorage first so persist middleware cannot race with stale blobs.
 */
export function clearBudgetData(): void {
  try {
    localStorage.removeItem('buddget-storage')
    localStorage.removeItem('buddget-ui-settings')
    localStorage.removeItem('buddget-notifications-read')
    localStorage.removeItem('buddget-pwa-install-banner-dismissed-at')
    localStorage.removeItem('pwa-install-dismissed')
  } catch {
    // SSR or restricted storage — ignore
  }

  useFinanceStore.getState().resetAllData()
  useSettingsStore.getState().resetSettings()
}
