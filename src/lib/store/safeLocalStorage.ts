import type { StateStorage } from 'zustand/middleware'

/** In-memory fallback when `localStorage` / `sessionStorage` throws (Safari private mode, quota). */
const memory = new Map<string, string>()

const STORAGE_MODE_KEY = 'buddget_storage_mode'

export type StorageMode = 'guest' | 'auth' | null

/**
 * Zustand `persist` storage that survives Safari private browsing / quota errors.
 * Backs onto `window.localStorage` — for an auth session or the default case.
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
      try {
        return window.localStorage.getItem(name)
      } catch {
        return memory.get(name) ?? null
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value)
      } catch {
        memory.set(name, value)
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name)
      } catch {
        memory.delete(name)
      }
    },
  }
}

/**
 * Zustand `persist` storage backed by `window.sessionStorage`. Used for guest
 * sessions so their state evaporates when the tab closes.
 */
export function createSafeSessionStorage(): StateStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }
  return {
    getItem: (name) => {
      try {
        return window.sessionStorage.getItem(name)
      } catch {
        return memory.get(name) ?? null
      }
    },
    setItem: (name, value) => {
      try {
        window.sessionStorage.setItem(name, value)
      } catch {
        memory.set(name, value)
      }
    },
    removeItem: (name) => {
      try {
        window.sessionStorage.removeItem(name)
      } catch {
        memory.delete(name)
      }
    },
  }
}

/**
 * Storage adapter that dispatches every call based on the current mode flag
 * (`buddget_storage_mode` in sessionStorage). When the flag is `'guest'`, reads
 * and writes go to sessionStorage; otherwise localStorage. The lookup is
 * per-call (not per-store-init) so `setStorageMode()` takes effect immediately
 * without a `persist.setOptions` runtime swap.
 *
 * Memoise the two backends so we don't pay the factory cost on every access.
 */
export function createModeAwareStorage(): StateStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }
  const local = createSafeLocalStorage()
  const session = createSafeSessionStorage()
  const pick = (): StateStorage => {
    try {
      return window.sessionStorage.getItem(STORAGE_MODE_KEY) === 'guest' ? session : local
    } catch {
      return local
    }
  }
  return {
    getItem: (name) => pick().getItem(name),
    setItem: (name, value) => pick().setItem(name, value),
    removeItem: (name) => pick().removeItem(name),
  }
}

/**
 * Set / clear the mode flag read by `createModeAwareStorage`. Called by
 * AuthProvider on guest start / auth success / sign-out.
 */
export function setStorageMode(mode: StorageMode): void {
  if (typeof window === 'undefined') return
  try {
    if (mode === null) {
      window.sessionStorage.removeItem(STORAGE_MODE_KEY)
    } else {
      window.sessionStorage.setItem(STORAGE_MODE_KEY, mode)
    }
  } catch {
    /* private mode / quota — handled by memory fallback in the adapters */
  }
}

/** Returns the current storage mode flag (null when unset). */
export function readStorageMode(): StorageMode {
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(STORAGE_MODE_KEY)
    return v === 'guest' || v === 'auth' ? v : null
  } catch {
    return null
  }
}
