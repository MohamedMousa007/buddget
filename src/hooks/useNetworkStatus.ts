'use client'

import { useSyncExternalStore } from 'react'
import { isNative } from '@/lib/native/isNative'

/**
 * Single source of truth for connectivity.
 *
 * Web: navigator.onLine + online/offline window events.
 * Native: @capacitor/network — the OS-level status, because navigator.onLine
 * is unreliable inside Capacitor webviews (can stay true in airplane mode).
 *
 * React components use `useNetworkStatus()`; non-React modules (sync engine,
 * SMS drain) use `subscribeNetwork(cb)` / `isOnline()`.
 */

let online = typeof navigator === 'undefined' ? true : navigator.onLine
const listeners = new Set<(online: boolean) => void>()
let started = false

function emit(next: boolean) {
  if (next === online) return
  online = next
  for (const cb of listeners) cb(online)
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => emit(true))
  window.addEventListener('offline', () => emit(false))
  if (isNative()) {
    void (async () => {
      try {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        emit(status.connected)
        await Network.addListener('networkStatusChange', (s) => emit(s.connected))
      } catch { /* web events above remain the fallback */ }
    })()
  }
}

export function isOnline(): boolean {
  start()
  return online
}

/** Subscribe to online/offline transitions. Returns an unsubscribe fn. */
export function subscribeNetwork(cb: (online: boolean) => void): () => void {
  start()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useNetworkStatus(): { online: boolean } {
  const current = useSyncExternalStore(
    (onStoreChange) => subscribeNetwork(onStoreChange),
    () => (start(), online),
    () => true, // SSR: assume online
  )
  return { online: current }
}
