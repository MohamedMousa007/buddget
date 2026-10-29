import {
  formatProxyAiErrorForUser,
  isBuddgetServerThrottleMessage,
} from '@/lib/ai/formatAiProxyError'
import { apiFetchAuth } from '@/lib/apiBase'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { quotaDeniedMessage } from '@/lib/ai/quotaDeniedCopy'

/** POST body for `/api/ai` (Gemini proxy). */
export interface GeminiProxyRequestBody {
  contents: unknown[]
  generationConfig?: Record<string, unknown>
  /** Opt-in Google Search grounding (live facts). Only set by callers that need it. */
  grounded?: boolean
  systemInstruction?: { parts: { text: string }[] }
  /** Buddgy model tier; untiered callers get the legacy model. */
  tier?: 'fast' | 'smart'
  /** Server-sent events (streamGenerateContent). */
  stream?: boolean
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BACKOFF_MS = 1800

/** User-facing copy when the app-side throttle or cooldown applies. */
export const SYSTEM_RESTING_MESSAGE = 'Taking a quick breather — try again in a moment 😊'

/** A quota denial (stage 'quota') is a plan limit, not a transient 429: retrying cannot help. */
async function isQuotaDenied(response: Response): Promise<boolean> {
  if (response.status !== 429) return false
  const body = (await response.clone().json().catch(() => null)) as { stage?: string } | null
  return body?.stage === 'quota'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calls `/api/ai` with bounded retries on 429 (Buddget throttle or transient limits).
 * Keeps spend predictable by reusing the same proxy route; does not add extra model calls on success.
 */
export async function generateWithFallback(
  body: GeminiProxyRequestBody,
  options?: { maxAttempts?: number; backoffMs?: number; signal?: AbortSignal }
): Promise<Response> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const backoffMs = Math.max(0, options?.backoffMs ?? DEFAULT_BACKOFF_MS)

  let last: Response | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await apiFetchAuth('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    })
    last = response
    if (response.status !== 429 || (await isQuotaDenied(response))) return response
    if (attempt < maxAttempts - 1) await sleep(backoffMs * (attempt + 1))
  }
  return last as Response
}

/**
 * Same retry behavior as {@link generateWithFallback}, for Route Handlers: calls `/api/ai` on the
 * incoming request origin and forwards the Cookie header so `getUser()` succeeds.
 */
export async function generateWithFallbackFromRequest(
  req: Request,
  body: GeminiProxyRequestBody,
  options?: { maxAttempts?: number; backoffMs?: number }
): Promise<Response> {
  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') ?? ''
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const backoffMs = Math.max(0, options?.backoffMs ?? DEFAULT_BACKOFF_MS)

  let last: Response | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${origin}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    })
    last = response
    if (response.status !== 429 || (await isQuotaDenied(response))) return response
    if (attempt < maxAttempts - 1) await sleep(backoffMs * (attempt + 1))
  }
  return last as Response
}

/** Shown when Gemini is not configured server-side (503 from `/api/ai`). */
export const AI_UNAVAILABLE_MANUAL_SETUP_MESSAGE =
  'AI is currently unavailable. You can still set up your budget manually using the category editor above.'

/** Maps failed proxy responses to a single Error for callers (Gemini vs Buddget throttle). */
export async function throwIfAiProxyNotOk(response: Response): Promise<void> {
  if (response.ok) return
  const errorData = (await response.clone().json().catch(() => null)) as { error?: string; stage?: string; layer?: string; resetAt?: string | null } | null
  if (errorData?.stage === 'quota') {
    const lang = useFinanceStore.getState().settings.language === 'ar' ? 'ar' : 'en'
    throw new Error(quotaDeniedMessage(errorData.layer, errorData.resetAt, lang))
  }
  const raw = errorData?.error || `Oops, something didn't go as planned (${response.status})`
  if (response.status === 503) {
    throw new Error(AI_UNAVAILABLE_MANUAL_SETUP_MESSAGE)
  }
  if (response.status === 429) {
    if (isBuddgetServerThrottleMessage(raw)) {
      throw new Error(SYSTEM_RESTING_MESSAGE)
    }
    throw new Error(formatProxyAiErrorForUser(raw, response.status))
  }
  throw new Error(formatProxyAiErrorForUser(raw, response.status))
}
