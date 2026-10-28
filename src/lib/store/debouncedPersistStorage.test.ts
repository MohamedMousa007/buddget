import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedJsonStorage } from './debouncedPersistStorage'

describe('debounced persist cancelPending', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('drops queued writes so they never reach storage', () => {
    const data = new Map<string, string>()
    const storage = createDebouncedJsonStorage<{ a: number }>(
      () => ({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }),
      150,
    )
    storage.setItem('k', { state: { a: 1 }, version: 0 })
    storage.cancelPending()
    vi.advanceTimersByTime(1000)
    expect(data.has('k')).toBe(false)
    storage.setItem('k', { state: { a: 2 }, version: 0 })
    vi.advanceTimersByTime(200)
    expect(data.get('k')).toContain('"a":2')
  })
})
