import type { StateStorage } from 'zustand/middleware'

/** Values that localStorage refused (quota, Safari private mode). The newest write always lives here until it fits again. */
const memory = new Map<string, string>()

/** Fired once per session the first time a write is refused, so the shell can warn that edits may not survive a restart. */
export const STORAGE_QUOTA_EVENT = 'buddget:storage-quota'
let quotaAnnounced = false

export function __resetSafeStorageForTests(): void {
  memory.clear()
  quotaAnnounced = false
}

/** True while a write the device refused is only held in memory: what is on disk is older than what the app shows. */
export function hasUnpersistedWrites(): boolean {
  return memory.size > 0
}

function announceQuota() {
  if (quotaAnnounced) return
  quotaAnnounced = true
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_QUOTA_EVENT))
  } catch {
    /* noop */
  }
}

/**
 * Zustand `persist` storage that survives Safari private browsing / quota errors.
 * Memory wins on read: it only holds a value when the newer write could not be persisted.
 */
export function createSafeLocalStorage(): StateStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }
  return {
    getItem: (name) => {
      const pending = memory.get(name)
      if (pending !== undefined) return pending
      try {
        return window.localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value)
        memory.delete(name)
      } catch {
        memory.set(name, value)
        announceQuota()
      }
    },
    removeItem: (name) => {
      memory.delete(name)
      try {
        window.localStorage.removeItem(name)
      } catch {
        /* noop */
      }
    },
  }
}
