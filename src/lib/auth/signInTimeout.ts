/** D-6: how long the password sign-in request may run before the user is told and offered a retry. */
export const SIGNIN_TIMEOUT_MS = 20_000

/** The promise's value, or 'timeout' once `ms` passes first. The promise keeps running: the caller decides what a late answer means. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), ms) }),
  ]).finally(() => clearTimeout(timer))
}

/** Waits between device-check attempts: a cold server compiles the route on the first call (runner job 24). */
export const DEVICE_CHECK_RETRY_MS = [1000, 3000, 6000]

/**
 * Retries a request that failed transiently (thrown, 5xx, 401/404 while the session cookie or the route is not ready yet).
 * A 2xx or another 4xx is returned at once; after the last wait the final answer (or error) stands.
 */
export async function fetchWithRetry(call: () => Promise<Response>, waits = DEVICE_CHECK_RETRY_MS, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<Response> {
  for (const wait of waits) {
    try {
      const res = await call()
      if (res.ok || (res.status < 500 && res.status !== 401 && res.status !== 404)) return res
    } catch {
      /* retry */
    }
    await sleep(wait)
  }
  return call()
}
