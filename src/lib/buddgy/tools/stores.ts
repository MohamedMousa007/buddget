import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** Live snapshots for executors. Read at call time, never cached across a turn. */
export const fin = () => useFinanceStore.getState()
export const ui = () => useSettingsStore.getState()
