import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** Notes saved before memories were synced lived on this device only; move them over once. */
export function migrateLegacyNotes(): void {
  const legacy = useSettingsStore.getState().buddgyNotes
  if (legacy.length === 0) return
  const add = useFinanceStore.getState().addBuddgyMemory
  for (const note of legacy) add(note, 'chat')
  useSettingsStore.getState().clearBuddgyNotes()
}

export function activeMemoryTexts(): string[] {
  return useFinanceStore.getState().buddgyMemories.filter((m) => m.status === 'active').map((m) => m.text)
}
