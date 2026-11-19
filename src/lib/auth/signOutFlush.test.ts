import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleBeforeWipe, SIGNOUT_FLUSH_TIMEOUT_MS } from './signOutFlush'

describe('QA-65: sign-out sends, then wipes, and never hangs on a stalled request', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a flush that lands in time wipes without asking', async () => {
    const ask = vi.fn(async () => true)
    await settleBeforeWipe(Promise.resolve(), ask)
    expect(ask).not.toHaveBeenCalled()
  })

  it('a failed flush is not a reason to wait either', async () => {
    const ask = vi.fn(async () => true)
    await settleBeforeWipe(Promise.reject(new Error('offline')), ask)
    expect(ask).not.toHaveBeenCalled()
  })

  it('edits still unsent at the timeout: asks, and "sign out anyway" wipes at once', async () => {
    const ask = vi.fn(async () => true)
    let done = false
    void settleBeforeWipe(new Promise(() => {}), ask).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(SIGNOUT_FLUSH_TIMEOUT_MS - 1)
    expect(ask).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(done).toBe(true)
  })

  it('"keep waiting" holds the wipe until the flush has finished', async () => {
    let finish!: () => void
    const flush = new Promise<void>((r) => { finish = r })
    let done = false
    void settleBeforeWipe(flush, async () => false).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(SIGNOUT_FLUSH_TIMEOUT_MS)
    expect(done).toBe(false)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })
})
