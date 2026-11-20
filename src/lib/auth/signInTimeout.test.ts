import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithRetry, withTimeout } from './signInTimeout'

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

describe('fetchWithRetry', () => {
  const noWait = async () => {}
  const seq = (...answers: Array<number | 'throw'>) => {
    let i = 0
    return vi.fn(async () => {
      const a = answers[Math.min(i++, answers.length - 1)]
      if (a === 'throw') throw new Error('network')
      return new Response('{}', { status: a })
    })
  }

  it('retries a cold-server 500, a 401 before the cookie lands and a thrown fetch, then returns the 200', async () => {
    const call = seq(500, 401, 'throw', 200)
    expect((await fetchWithRetry(call, [1, 1, 1], noWait)).status).toBe(200)
    expect(call).toHaveBeenCalledTimes(4)
  })

  it('returns a definite 4xx at once', async () => {
    const call = seq(403)
    expect((await fetchWithRetry(call, [1, 1, 1], noWait)).status).toBe(403)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('gives up after the last wait so the caller still fails closed', async () => {
    const call = seq(503)
    expect((await fetchWithRetry(call, [1, 1], noWait)).status).toBe(503)
    expect(call).toHaveBeenCalledTimes(3)
  })
})
