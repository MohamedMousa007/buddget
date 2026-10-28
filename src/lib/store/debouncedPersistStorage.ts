import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware'

/**
 * Zustand `persist` storage that serialises and writes at most once per `waitMs` burst.
 * Zustand's own JSON storage stringifies on every `set()`; at 20k expenses that is a ~50 ms
 * main-thread stall per write. The newest value is flushed when the page is hidden or closed,
 * so a backgrounded app never loses the last edit.
 */
export type DebouncedPersistStorage<S> = PersistStorage<S> & { cancelPending: () => void }

export function createDebouncedJsonStorage<S>(
  getStorage: () => StateStorage,
  waitMs: number,
): DebouncedPersistStorage<S> {
  const storage = getStorage()
  const pending = new Map<string, StorageValue<S>>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    for (const [name, value] of pending) storage.setItem(name, JSON.stringify(value))
    pending.clear()
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
  }

  return {
    cancelPending: () => {
      if (timer) clearTimeout(timer)
      timer = null
      pending.clear()
    },
    getItem: (name) => {
      const queued = pending.get(name)
      if (queued) return queued
      const raw = storage.getItem(name)
      if (raw === null || raw === undefined) return null
      return JSON.parse(raw as string) as StorageValue<S>
    },
    setItem: (name, value) => {
      pending.set(name, value)
      timer ??= setTimeout(flush, waitMs)
    },
    removeItem: (name) => {
      pending.delete(name)
      storage.removeItem(name)
    },
  }
}
