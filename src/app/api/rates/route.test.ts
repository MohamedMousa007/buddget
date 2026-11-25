import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rpc: vi.fn(), afters: [] as Array<() => unknown> }))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => { h.afters.push(fn) } }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc: h.rpc }) }))

const FULL = { AED: 3.67, EGP: 48.5, EUR: 0.92, GBP: 0.79, SAR: 3.75, KWD: 0.31, QAR: 3.64, BHD: 0.376, OMR: 0.385, MAD: 10, TND: 3.1, JOD: 0.709, XAU: 0.0004 }

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
const down = () => Promise.resolve(new Response('', { status: 503 }))

async function run(fetchImpl: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((url: string) => fetchImpl(String(url))))
  const { GET } = await import('./route')
  const res = await GET()
  for (const fn of h.afters.splice(0)) await fn()
  return res
}

const fingerprints = () => h.rpc.mock.calls.map((c) => (c[1] as { p_fingerprint: string }).p_fingerprint)
const today = () => new Date().toISOString().slice(0, 10)

describe('GET /api/rates missing-rate report', () => {
  beforeEach(() => {
    vi.resetModules()
    h.rpc.mockReset().mockResolvedValue({ error: null })
    h.afters.length = 0
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('never reports when every currency has a rate', async () => {
    const res = await run((url) => (url.includes('open.er-api') ? ok({ result: 'success', rates: FULL }) : down()))
    expect(res.status).toBe(200)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('reports each missing currency once per day, as a warning with no user data, however many calls fail', async () => {
    const noEgp: Partial<typeof FULL> = { ...FULL }
    delete noEgp.EGP
    const fetchNoEgp = (url: string) => (url.includes('open.er-api') ? ok({ result: 'success', rates: noEgp }) : down())
    const { GET } = await (async () => { vi.stubGlobal('fetch', vi.fn((u: string) => fetchNoEgp(String(u)))); return import('./route') })()
    expect((await GET()).status).toBe(200)
    expect((await GET()).status).toBe(200)
    for (const fn of h.afters.splice(0)) await fn()
    expect(fingerprints()).toEqual([`fx_rate_missing:EGP:${today()}`])
    expect(h.rpc).toHaveBeenCalledWith('record_client_crash', expect.objectContaining({
      p_level: 'warning', p_platform: 'server', p_release: '', p_title: 'FX rate missing: EGP',
      p_culprit: 'api/rates open.er-api.com', p_user_id: null, p_device_id: null, p_build: null,
    }))
  })

  it('never reports gold: XAU is priced by /api/gold, not the FX feed', async () => {
    const noGold: Partial<typeof FULL> = { ...FULL }
    delete noGold.XAU
    const res = await run((url) => (url.includes('open.er-api') ? ok({ result: 'success', rates: noGold }) : down()))
    expect(res.status).toBe(200)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('reports ALL as an error when every provider fails, and still answers 502', async () => {
    const { GET } = await (async () => { vi.stubGlobal('fetch', vi.fn(() => down())); return import('./route') })()
    expect((await GET()).status).toBe(502)
    expect((await GET()).status).toBe(502)
    for (const fn of h.afters.splice(0)) await fn()
    expect(fingerprints()).toEqual([`fx_rate_missing:ALL:${today()}`])
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_level: 'error' })
  })

  it('a failing report never fails the response', async () => {
    h.rpc.mockRejectedValue(new Error('db down'))
    const res = await run(() => down())
    expect(res.status).toBe(502)
  })
})
