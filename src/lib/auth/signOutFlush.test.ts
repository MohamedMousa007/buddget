import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleBeforeWipe, SIGNOUT_FLUSH_TIMEOUT_MS } from './signOutFlush'

describe('QA-65 / D-2: sign-out wipes only what the server acknowledged, and never hangs', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('every edit acknowledged in time: wipes without asking', async () => {
    const ask = vi.fn(async () => true)
    await expect(settleBeforeWipe(Promise.resolve(true), ask)).resolves.toBe(true)
    expect(ask).not.toHaveBeenCalled()
  })

  it('D-2: a flush that settled but left edits unsent (offline) asks before wiping', async () => {
    const ask = vi.fn(async () => false)
    await expect(settleBeforeWipe(Promise.resolve(false), ask)).resolves.toBe(false)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('D-2: a failed flush asks; "sign out anyway" wipes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ask = vi.fn(async () => true)
    await expect(settleBeforeWipe(Promise.reject(new Error('offline')), ask)).resolves.toBe(true)
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('a flush still running at the timeout asks, and "stay signed in" keeps the data', async () => {
    const ask = vi.fn(async () => false)
    let result: boolean | undefined
    void settleBeforeWipe(new Promise(() => {}), ask).then((r) => { result = r })
    await vi.advanceTimersByTimeAsync(SIGNOUT_FLUSH_TIMEOUT_MS - 1)
    expect(ask).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(result).toBe(false)
  })
})
