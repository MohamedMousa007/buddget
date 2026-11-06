/**
 * Calls `onForeignWrite` when ANOTHER tab of this origin writes `key` to localStorage (the `storage` event never fires
 * in the tab that wrote). A removal is ignored: sign-out is handled by the auth listener of every tab.
 */
export function watchForeignWrites(key: string, onForeignWrite: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: Event) => {
    const { key: k, newValue } = e as StorageEvent
    if (k === key && newValue !== null) onForeignWrite()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
