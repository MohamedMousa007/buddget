const entries = new Map<string, { at: number; value: Promise<unknown> }>()

/**
 * One request for any number of callers within `ttlMs`: components that need the same server data (a detector banner and
 * the review sheet that both read the SMS log) share one promise instead of each querying the database. A failed load is
 * dropped so the next caller retries.
 */
export function sharedFetch<T>(key: string, ttlMs: number, load: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = entries.get(key)
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>
  const value = load().catch((e) => {
    if (entries.get(key)?.value === value) entries.delete(key)
    throw e
  })
  entries.set(key, { at: now, value })
  return value
}

/** Forget what was cached (sign-out, or after data the cache describes was changed on purpose). */
export function clearSharedFetches(): void {
  entries.clear()
}
