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
