import {
  formatProxyAiErrorForUser,
  isBuddgetServerThrottleMessage,
} from '@/lib/ai/formatAiProxyError'

/** POST body shape for `/api/ai` (Gemini proxy). */
export interface GeminiProxyRequestBody {
  contents: unknown[]
  generationConfig?: Record<string, unknown>
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 1800

/** User-facing copy when the app-side throttle or cooldown applies. */
export const SYSTEM_RESTING_MESSAGE =
  'Taking a quick breather — try again in a moment 😊'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calls `/api/ai` with bounded retries on 429 (Buddget throttle or transient limits).
 * Keeps spend predictable by reusing the same proxy route; does not add extra model calls on success.
 */
export async function generateWithFallback(
  body: GeminiProxyRequestBody,
  options?: { maxAttempts?: number; backoffMs?: number }
): Promise<Response> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const backoffMs = Math.max(0, options?.backoffMs ?? DEFAULT_BACKOFF_MS)

  let last: Response | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    last = response
    if (response.status !== 429) return response
    if (attempt < maxAttempts - 1) await sleep(backoffMs * (attempt + 1))
  }
  return last as Response
}

/** Maps failed proxy responses to a single Error for callers (Gemini vs Buddget throttle). */
export async function throwIfAiProxyNotOk(response: Response): Promise<void> {
  if (response.ok) return
  const errorData = (await response.json().catch(() => null)) as { error?: string } | null
  const raw = errorData?.error || `Oops, something didn't go as planned (${response.status})`
  if (response.status === 429) {
    if (isBuddgetServerThrottleMessage(raw)) {
      throw new Error(SYSTEM_RESTING_MESSAGE)
    }
    throw new Error(formatProxyAiErrorForUser(raw, response.status))
  }
  throw new Error(formatProxyAiErrorForUser(raw, response.status))
}
