import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clearBudgetData } from '@/lib/auth/clearBudgetData'
import { cacheOwnerMismatch } from '@/lib/auth/cacheOwnerCheck'
import { suspendFinanceSync } from '@/components/sync/SupabaseFinanceSync'


/**
 * The persisted finance store hydrates from localStorage before auth resolves, and the owner of that cache is the
 * profile id written by the server pull (`serverSyncedFor` is a second marker). If the session user differs, the cache
 * is another account's data (sign-out interrupted, token swapped without SIGNED_OUT): wipe it, never merge or push it.
 * Returns true when it wiped.
 */
export function reconcileCacheOwner(userId: string): boolean {
  const owners = [useFinanceStore.getState().profile.id, useSettingsStore.getState().serverSyncedFor]
  if (!owners.some((o) => cacheOwnerMismatch(o, userId))) return false
  suspendFinanceSync()
  clearBudgetData()
  return true
}

export { cacheOwnerMismatch }
