/**
 * Tests for the unified network-status source (web event path).
 * Native (@capacitor/network) is exercised on-device; here we verify the
 * subscribe/emit contract the sync engine and SMS drain depend on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/native/isNative', () => ({ isNative: () => false }))

type Handler = () => void
const handlers: Record<string, Handler[]> = {}

function fire(event: 'online' | 'offline') {
  for (const h of handlers[event] ?? []) h()
}

beforeEach(() => {
  vi.resetModules()
  handlers.online = []
  handlers.offline = []
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('window', {
    addEventListener: (ev: string, cb: Handler) => {
      ;(handlers[ev] ??= []).push(cb)
    },
    removeEventListener: () => {},
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('network status', () => {
  it('reflects navigator.onLine initially and follows online/offline events', async () => {
    const net = await import('@/hooks/useNetworkStatus')
    expect(net.isOnline()).toBe(true)
    fire('offline')
    expect(net.isOnline()).toBe(false)
    fire('online')
    expect(net.isOnline()).toBe(true)
  })

  it('notifies subscribers exactly once per transition (no duplicate emits)', async () => {
    const net = await import('@/hooks/useNetworkStatus')
    const seen: boolean[] = []
    net.subscribeNetwork((online) => seen.push(online))
    fire('offline')
    fire('offline') // same state — must not re-emit
    fire('online')
    expect(seen).toEqual([false, true])
  })

  it('stops notifying after unsubscribe', async () => {
    const net = await import('@/hooks/useNetworkStatus')
    const seen: boolean[] = []
    const unsub = net.subscribeNetwork((online) => seen.push(online))
    fire('offline')
    unsub()
    fire('online')
    expect(seen).toEqual([false])
  })
})
