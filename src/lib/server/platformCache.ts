import { revalidateTag, unstable_cache } from 'next/cache'

/** Every cached platform setting (billing switch, AI pricing and throttle, client gate, app config) carries this tag. */
export const PLATFORM_SETTINGS_TAG = 'platform-settings'

/**
 * Read through the shared Next/Vercel data cache (one copy for every serverless instance) instead of each cold instance asking the
 * database. `read` must throw on failure so errors are never cached. Outside a Next request (tests, scripts) it just reads.
 */
export async function cachedSetting<T>(keyParts: string[], read: () => Promise<T>, revalidateSeconds = 300): Promise<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown } | null = null
  try {
    return await unstable_cache(
      async () => {
        try {
          return await read()
        } catch (error) {
          outcome = { ok: false, error }
          throw error
        }
      },
      ['platform-setting', ...keyParts],
      { tags: [PLATFORM_SETTINGS_TAG], revalidate: revalidateSeconds },
    )()
  } catch (error) {
    // A failed read is the caller's to handle; anything else (no Next cache available) falls back to a plain read.
    if ((outcome as { ok: boolean } | null)?.ok === false) throw error
    return read()
  }
}

/** Call after any admin write to a platform setting so every instance sees the new value at once. */
export function invalidatePlatformSettings(): void {
  try {
    revalidateTag(PLATFORM_SETTINGS_TAG, { expire: 0 })
  } catch {
    /* outside a Next request (tests): nothing is cached */
  }
}
