/** How long the app may sit in the background before an enabled app lock asks again. */
export const RELOCK_AFTER_MS = 60_000

let nativeFlows = 0

/** A native UI (scanner, camera, permission dialog, OAuth) hides the WebView without the user leaving the app. */
export function beginNativeFlow(): void { nativeFlows++ }
export function endNativeFlow(): void { nativeFlows = Math.max(0, nativeFlows - 1) }
export function isNativeFlowActive(): boolean { return nativeFlows > 0 }

export async function withNativeFlow<T>(run: () => Promise<T>): Promise<T> {
  beginNativeFlow()
  try { return await run() } finally { endNativeFlow() }
}

export function shouldRelock(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt > RELOCK_AFTER_MS
}
