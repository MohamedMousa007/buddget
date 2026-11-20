import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from './signInTimeout'

describe('D-6: sign-in request timeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('an answer in time is returned as is', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok')
  })

  it('a request still running at the limit reports a timeout', async () => {
    const r = withTimeout(new Promise(() => {}), 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(r).resolves.toBe('timeout')
  })
})
