import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SECOND_FACTOR_SUPPRESS_MS,
  isSecondFactorBlocked,
  isSecondFactorError,
  noteSecondFactorResponse,
  onSecondFactorResolved,
  secondFactorAwareFetch,
  useSecondFactorGate,
} from '@/lib/auth/secondFactorGate'

const refusal = () =>
  new Response(JSON.stringify({ code: 'second_factor_required', message: 'Verify' }), {
    status: 403,
    headers: { 'X-Second-Factor-Required': 'true' },
  })

beforeEach(() => useSecondFactorGate.setState({ open: false, suppressUntil: 0 }))
afterEach(() => vi.unstubAllGlobals())

describe('second factor detection', () => {
  it('recognises PostgREST error shapes', () => {
    expect(isSecondFactorError({ code: 'second_factor_required' })).toBe(true)
    expect(isSecondFactorError({ message: '{"code":"second_factor_required"}' })).toBe(true)
    expect(isSecondFactorError('second_factor_required')).toBe(true)
    expect(isSecondFactorError({ code: '42501', message: 'rls' })).toBe(false)
    expect(isSecondFactorError(null)).toBe(false)
  })

  it('raises on the header or the body code, and leaves the response readable', async () => {
    const res = await noteSecondFactorResponse(refusal())
    expect(useSecondFactorGate.getState().open).toBe(true)
    expect((await res.json()).code).toBe('second_factor_required')
  })

  it('raises on a body-only 403 from a PostgREST url but ignores other 403s', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'second_factor_required' }), { status: 403 })))
    await secondFactorAwareFetch('https://x.supabase.co/rest/v1/expenses')
    expect(useSecondFactorGate.getState().open).toBe(true)
    useSecondFactorGate.setState({ open: false })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: '42501' }), { status: 403 })))
    await secondFactorAwareFetch('https://x.supabase.co/rest/v1/expenses')
    expect(useSecondFactorGate.getState().open).toBe(false)
  })

  it('ignores 200s', async () => {
    await noteSecondFactorResponse(new Response('{}', { status: 200 }))
    expect(useSecondFactorGate.getState().open).toBe(false)
  })
})

describe('no-loop guarantee', () => {
  it('raise is idempotent while open', () => {
    const { raise } = useSecondFactorGate.getState()
    raise(); raise(); raise()
    expect(useSecondFactorGate.getState().open).toBe(true)
  })

  it('a dismissed gate stays closed for the suppression window, then can reopen', () => {
    const g = useSecondFactorGate.getState()
    g.raise(1000)
    g.dismiss(1000)
    g.raise(1000 + 10)
    expect(useSecondFactorGate.getState().open).toBe(false)
    expect(isSecondFactorBlocked(1000 + 10)).toBe(true)
    g.raise(1000 + SECOND_FACTOR_SUPPRESS_MS + 1)
    expect(useSecondFactorGate.getState().open).toBe(true)
  })

  it('resolving clears the block and resumes listeners exactly once', () => {
    const resume = vi.fn()
    const off = onSecondFactorResolved(resume)
    useSecondFactorGate.getState().raise()
    useSecondFactorGate.getState().resolve()
    expect(resume).toHaveBeenCalledTimes(1)
    expect(isSecondFactorBlocked()).toBe(false)
    off()
  })
})

describe('bounded body read', () => {
  it('treats a body that never ends as not a refusal, within ~2s', async () => {
    vi.useFakeTimers()
    const res = new Response(new ReadableStream({ start() {} }), { status: 403 })
    const p = noteSecondFactorResponse(res)
    await vi.advanceTimersByTimeAsync(2100)
    await p
    vi.useRealTimers()
    expect(useSecondFactorGate.getState().open).toBe(false)
  })

  it('ignores an oversized body', async () => {
    const big = JSON.stringify({ code: 'second_factor_required', pad: 'x'.repeat(10_000) })
    await noteSecondFactorResponse(new Response(big, { status: 403 }))
    expect(useSecondFactorGate.getState().open).toBe(false)
  })
})
