'use client'

import { useSyncExternalStore } from 'react'
import { isNative } from '@/lib/native/isNative'

/**
 * Single source of truth for connectivity.
 *
 * Web: navigator.onLine + online/offline window events.
 * Native: @capacitor/network only — the OS-level status, because navigator.onLine
 * is unreliable inside Capacitor webviews (can stay true in airplane mode), and the
 * web events would flip state against it. Web events are used only if the plugin fails.
 *
 * React components use `useNetworkStatus()`; non-React modules (sync engine,
 * SMS drain) use `subscribeNetwork(cb)` / `isOnline()`.
 */

let online = typeof navigator === 'undefined' ? true : navigator.onLine
const listeners = new Set<(online: boolean) => void>()
let started = false
let markReady: () => void = () => {}

/** Resolves once the OS-level status is known (immediately on web), so a cold start can tell airplane mode from online. */
export const networkReady: Promise<void> = new Promise((resolve) => { markReady = resolve })

function emit(next: boolean) {
  if (next === online) return
  online = next
  for (const cb of listeners) cb(online)
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  if (!isNative()) markReady()
  if (!isNative()) {
    window.addEventListener('online', () => emit(true))
    window.addEventListener('offline', () => emit(false))
  } else {
    void (async () => {
      try {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        emit(status.connected)
        await Network.addListener('networkStatusChange', (s) => emit(s.connected))
      } catch {
        // The OS status is unreadable: fall back to the web events rather than staying frozen.
        window.addEventListener('online', () => emit(true))
        window.addEventListener('offline', () => emit(false))
      }
      finally { markReady() }
    })()
  }
}

start()
// SSR never starts the listeners; nothing awaits there, but never leave the promise pending.
if (typeof window === 'undefined') markReady()

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
