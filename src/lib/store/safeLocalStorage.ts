import type { StateStorage } from 'zustand/middleware'

/** In-memory fallback when `localStorage` throws (Safari private mode, quota). */
const memory = new Map<string, string>()

/**
 * Zustand `persist` storage that survives Safari private browsing / quota errors.
 * Both authenticated and anonymous-guest users persist here — guest identity
 * itself lives in Supabase via `signInAnonymously`, so localStorage is fine for
 * everyone.
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
