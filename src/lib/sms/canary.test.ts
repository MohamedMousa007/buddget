import { describe, expect, it, vi } from 'vitest'
import { CANARY_PREFLIGHT_HEADERS, runCanary } from './canary'
import { NATIVE_ALLOWED_HEADERS } from '@/lib/server/nativeApiCors'

const preflight = (allow: string) => new Response(null, { status: 204, headers: { 'access-control-allow-headers': allow } })
const base = 'https://api.test'

describe('runCanary', () => {
  it('passes against the real server allow-list: every header any build sends is allowed', async () => {
    const f = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (init?.method === 'OPTIONS' ? preflight(NATIVE_ALLOWED_HEADERS) : new Response('{}', { status: 401 })))
    const out = await runCanary({ base, fetchImpl: f as unknown as typeof fetch })
    expect(out.ok).toBe(true)
    expect(out.checks.map((c) => c.name)).toEqual(['cors_preflight', 'auth_gate'])
  })

  it('fails and names the header when the preflight stops allowing one (the original incident)', async () => {
    const f = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (init?.method === 'OPTIONS' ? preflight('Content-Type, Authorization, X-Buddget-Device-Id') : new Response('{}', { status: 401 })))
    const out = await runCanary({ base, fetchImpl: f as unknown as typeof fetch })
    expect(out.ok).toBe(false)
    expect(out.checks[0]).toMatchObject({ name: 'cors_preflight', ok: false })
    expect(out.checks[0]!.detail).toContain('x-sms-event-id')
  })

  it('fails when the endpoint stops refusing a bad token, and when it is unreachable', async () => {
    const open = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => (init?.method === 'OPTIONS' ? preflight(NATIVE_ALLOWED_HEADERS) : new Response('{}', { status: 200 })))
    expect((await runCanary({ base, fetchImpl: open as unknown as typeof fetch })).checks[1]).toMatchObject({ name: 'auth_gate', ok: false })
    const down = vi.fn(async () => { throw new TypeError('fetch failed') })
    const out = await runCanary({ base, fetchImpl: down as unknown as typeof fetch })
    expect(out.checks.every((c) => !c.ok)).toBe(true)
  })

  it('runs the end-to-end ingest only with a canary account, and fails if no row was written', async () => {
    const f = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'OPTIONS') return preflight(NATIVE_ALLOWED_HEADERS)
      return new Response('{}', { status: String(init?.headers && (init.headers as Record<string, string>).Authorization).includes('canary-invalid') ? 401 : 200 })
    })
    const none = await runCanary({ base, fetchImpl: f as unknown as typeof fetch })
    expect(none.checks).toHaveLength(2)
    const wrote = await runCanary({ base, fetchImpl: f as unknown as typeof fetch, token: 't', consumeRow: async () => true })
    expect(wrote.ok).toBe(true)
    const lost = await runCanary({ base, fetchImpl: f as unknown as typeof fetch, token: 't', consumeRow: async () => false })
    expect(lost.checks.at(-1)).toMatchObject({ name: 'end_to_end', ok: false })
  })

  it('probes every header the drain is known to send', () => {
    expect(CANARY_PREFLIGHT_HEADERS).toEqual(expect.arrayContaining(['authorization', 'content-type', 'x-buddget-device-id', 'x-sms-event-id']))
  })
})
