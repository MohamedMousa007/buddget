'use client'

import { useSyncExternalStore } from 'react'
import { getPlatform, isNative } from '@/lib/native/isNative'

export interface CapacitorState {
  ready: boolean
  native: boolean
  platform: 'ios' | 'android' | 'web'
}

const SSR_STATE: CapacitorState = { ready: false, native: false, platform: 'web' }

let cachedClientState: CapacitorState | null = null
function getClientSnapshot(): CapacitorState {
  if (!cachedClientState) {
    cachedClientState = { ready: true, native: isNative(), platform: getPlatform() }
  }
  return cachedClientState
}

function subscribe(): () => void {
  // Capacitor's runtime is determined at boot — there's nothing to react to
  // after the first render, so we return a noop unsubscribe.
  return () => {}
}

/**
 * Hook that resolves on the client (post-hydration) and surfaces the running
 * platform. Server renders return `{ ready: false, native: false, platform: 'web' }`
 * so SSR-time decisions stay deterministic.
 */
export function useCapacitor(): CapacitorState {
  return useSyncExternalStore(subscribe, getClientSnapshot, () => SSR_STATE)
}
