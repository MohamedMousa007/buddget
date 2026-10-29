import { create } from 'zustand'

export const SECOND_FACTOR_CODE = 'second_factor_required'
export const SECOND_FACTOR_HEADER = 'x-second-factor-required'
/** After the user dismisses or fails the challenge, the gate stays quiet this long so a refusing server cannot loop it. */
export const SECOND_FACTOR_SUPPRESS_MS = 5 * 60_000

interface GateState {
  open: boolean
  suppressUntil: number
  /** Called by a request wrapper when the server refused with second_factor_required. Idempotent. */
  raise: (now?: number) => void
  /** The user tried and gave up: stay quiet for a while. Local data is untouched. */
  dismiss: (now?: number) => void
  resolve: () => void
}

const listeners = new Set<() => void>()
/** Runs once each time the challenge is passed (used to resume the interrupted sync). */
export function onSecondFactorResolved(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useSecondFactorGate = create<GateState>((set, get) => ({
  open: false,
  suppressUntil: 0,
  raise: (now = Date.now()) => {
    const s = get()
    if (s.open || now < s.suppressUntil) return
    set({ open: true })
  },
  dismiss: (now = Date.now()) => set({ open: false, suppressUntil: now + SECOND_FACTOR_SUPPRESS_MS }),
  resolve: () => {
    set({ open: false, suppressUntil: 0 })
    listeners.forEach((fn) => fn())
  },
}))

/** True while the server is known to refuse this session: writers skip the doomed round-trip. */
export function isSecondFactorBlocked(now = Date.now()): boolean {
  const s = useSecondFactorGate.getState()
  return s.open || now < s.suppressUntil
}

/** Detects the refusal in any shape it arrives: a PostgREST error object, an error message, or a JSON body. */
export function isSecondFactorError(err: unknown): boolean {
  if (!err) return false
  if (typeof err === 'string') return err.includes(SECOND_FACTOR_CODE)
  if (typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown; error?: unknown }
    return e.code === SECOND_FACTOR_CODE || e.error === SECOND_FACTOR_CODE || (typeof e.message === 'string' && e.message.includes(SECOND_FACTOR_CODE))
  }
  return false
}

async function responseIsRefusal(res: Response, checkBody: boolean): Promise<boolean> {
  if (res.status !== 403) return false
  if (res.headers.get(SECOND_FACTOR_HEADER) === 'true') return true
  if (!checkBody) return false
  return isSecondFactorError(await readBoundedJson(res.clone()))
}

const BODY_MAX_CHARS = 4096
const BODY_TIMEOUT_MS = 2000

/** Reads at most BODY_MAX_CHARS within BODY_TIMEOUT_MS; any failure yields null (not a refusal). */
async function readBoundedJson(res: Response): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const text = await Promise.race([
      res.text(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), BODY_TIMEOUT_MS)
      }),
    ])
    if (text === null || text.length > BODY_MAX_CHARS) return null
    return JSON.parse(text)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    void res.body?.cancel().catch(() => {})
  }
}

/** Raises the gate when a response is the server's second-factor refusal. Returns the response untouched. */
export async function noteSecondFactorResponse(res: Response, checkBody = true): Promise<Response> {
  if (await responseIsRefusal(res, checkBody)) useSecondFactorGate.getState().raise()
  return res
}

/** fetch for supabase-js: every PostgREST/sync call passes through here. Never alters the response. */
export const secondFactorAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return noteSecondFactorResponse(res, url.includes('/rest/v1/'))
}
