import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Wipe all user data from Zustand stores and localStorage.
 * Call immediately before or after supabase.auth.signOut().
 */
export function clearBudgetData(): void {
  useFinanceStore.getState().resetAllData()
  useSettingsStore.getState().resetSettings()

  try {
    localStorage.removeItem('buddget-storage')
    localStorage.removeItem('buddget-ui-settings')
    localStorage.removeItem('buddget-notifications-read')
    localStorage.removeItem('pwa-install-dismissed')
  } catch {
    // SSR or restricted storage — ignore
  }
}
