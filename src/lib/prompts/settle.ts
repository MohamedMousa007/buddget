import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * A prompt the user has answered for good (zakat basis, "keep separate", "not a subscription", an ignored account).
 * It is hidden at once on this phone and recorded with the account's settings, so a new phone, a reinstall or a second
 * device does not ask again. A snooze (the card's ✕) is different: it is local and ends by itself.
 */
export function settlePrompt(key: string): void {
  useSettingsStore.getState().dismissBanner(key)
  const current = useFinanceStore.getState().settings.promptState ?? {}
  if (current[key]) return
  useFinanceStore.getState().updateSettings({ promptState: { ...current, [key]: new Date().toISOString() } })
}

/** Keys answered on any of the account's phones, as the settings carry them. */
export function settledKeys(promptState: Record<string, string> | undefined): string[] {
  return promptState ? Object.keys(promptState) : []
}
