import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSafeLocalStorage, STORAGE_QUOTA_EVENT, __resetSafeStorageForTests } from './safeLocalStorage'

function quotaStorage() {
  const data = new Map<string, string>()
  let full = false
  const api = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('full', 'QuotaExceededError')
      data.set(k, v)
    },
    removeItem: (k: string) => void data.delete(k),
  }
  return { api, fill: () => { full = true }, free: () => { full = false } }
}

describe('safeLocalStorage quota fallback', () => {
  beforeEach(() => __resetSafeStorageForTests())
  afterEach(() => vi.unstubAllGlobals())
  const mount = (ls: unknown) => {
    const bus = new EventTarget()
    vi.stubGlobal('window', { localStorage: ls, addEventListener: bus.addEventListener.bind(bus), removeEventListener: bus.removeEventListener.bind(bus), dispatchEvent: bus.dispatchEvent.bind(bus) })
  }

  it('reads the newer in-memory value, not the older persisted one, after a failed write', () => {
    const s = quotaStorage()
    mount(s.api)
    const store = createSafeLocalStorage()
    store.setItem('k', 'v1')
    s.fill()
    store.setItem('k', 'v2')
    expect(store.getItem('k')).toBe('v2')
  })

  it('goes back to localStorage once a write succeeds again', () => {
    const s = quotaStorage()
    mount(s.api)
    const store = createSafeLocalStorage()
    s.fill()
    store.setItem('k', 'v2')
    s.free()
    store.setItem('k', 'v3')
    expect(s.api.getItem('k')).toBe('v3')
    expect(store.getItem('k')).toBe('v3')
  })

  it('announces the quota problem once, not on every write', () => {
    const s = quotaStorage()
    mount(s.api)
    const seen = vi.fn()
    window.addEventListener(STORAGE_QUOTA_EVENT, seen)
    const store = createSafeLocalStorage()
    s.fill()
    store.setItem('k', 'a')
    store.setItem('k', 'b')
    expect(seen).toHaveBeenCalledTimes(1)
  })
})
