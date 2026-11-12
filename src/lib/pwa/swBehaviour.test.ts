import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

type Handler = (e: Record<string, unknown>) => void

function boot(file: string, online: () => boolean) {
  const handlers: Record<string, Handler> = {}
  const stores = new Map<string, Map<string, Response>>()
  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const m = stores.get(name)!
    const key = (r: string | { url: string }) => (typeof r === 'string' ? new URL(r, 'https://app.test').href : r.url)
    return {
      match: async (r: string | { url: string }) => m.get(key(r)),
      put: async (r: string | { url: string }, res: Response) => { m.set(key(r), res) },
      add: async (r: string) => { const res = await fetchStub(r); if (!res.ok) throw new Error('bad'); m.set(key(r), res) },
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: string | { url: string }) => m.delete(key(r)),
    }
  }
  const caches = {
    open: async (n: string) => cacheOf(n),
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    match: async (r: string) => { for (const n of stores.keys()) { const hit = await cacheOf(n).match(r); if (hit) return hit } },
  }
  const fetched: string[] = []
  const fetchStub = async (r: string | { url: string }) => {
    const url = typeof r === 'string' ? new URL(r, 'https://app.test').href : r.url
    fetched.push(url)
    if (!online()) throw new TypeError('offline')
    return new Response('ok')
  }
  let unregistered = false
  const self = {
    addEventListener: (t: string, h: Handler) => { handlers[t] = h },
    location: { origin: 'https://app.test' },
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: { unregister: async () => { unregistered = true } },
    skipWaiting: () => {},
  }
  new Function('self', 'caches', 'fetch', readFileSync(file, 'utf8'))(self, caches, fetchStub)
  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = []
    let responded: Promise<Response> | undefined
    handlers[type]({ ...extra, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => { responded = p } })
    await Promise.all(waits)
    return { response: responded ? await responded : undefined, handled: !!responded, waits }
  }
  const req = (path: string, mode = 'no-cors') => ({ request: { method: 'GET', url: `https://app.test${path}`, mode } })
  return { fire, req, stores, fetched, unregistered: () => unregistered }
}

describe('public/sw.js behaviour', () => {
  it('install fails (so the old worker stays) when the offline page cannot be fetched', async () => {
    const sw = boot('public/sw.js', () => false)
    await expect(sw.fire('install')).rejects.toThrow()
  })

  it('offline: a page navigation gets the cached offline page', async () => {
    let up = true
    const sw = boot('public/sw.js', () => up)
    await sw.fire('install')
    up = false
    const { response } = await sw.fire('fetch', sw.req('/flow', 'navigate'))
    expect(await response!.text()).toBe('ok')
    expect(sw.fetched.at(-1)).toBe('https://app.test/flow')
  })

  it('online: pages go to the network and are never stored', async () => {
    const sw = boot('public/sw.js', () => true)
    await sw.fire('install')
    await sw.fire('fetch', sw.req('/flow', 'navigate'))
    const stored = [...sw.stores.values()].flatMap((m) => [...m.keys()])
    expect(stored).toEqual(['https://app.test/offline'])
  })

  it('never touches /api/ or cross-origin or non-GET requests', async () => {
    const sw = boot('public/sw.js', () => true)
    expect((await sw.fire('fetch', sw.req('/api/sms/undo'))).handled).toBe(false)
    expect((await sw.fire('fetch', { request: { method: 'POST', url: 'https://app.test/_next/static/a.js', mode: 'cors' } })).handled).toBe(false)
    expect((await sw.fire('fetch', { request: { method: 'GET', url: 'https://other.test/_next/static/a.js', mode: 'cors' } })).handled).toBe(false)
  })

  it('hashed assets are cache-first and the cache is capped', async () => {
    const sw = boot('public/sw.js', () => true)
    await sw.fire('fetch', sw.req('/_next/static/a.js'))
    const before = sw.fetched.length
    await sw.fire('fetch', sw.req('/_next/static/a.js'))
    expect(sw.fetched.length).toBe(before)
    for (let i = 0; i < 200; i++) await sw.fire('fetch', sw.req(`/_next/static/c${i}.js`))
    expect(sw.stores.get('static-v2')!.size).toBe(150)
    expect(sw.stores.get('static-v2')!.has('https://app.test/_next/static/a.js')).toBe(false)
  })

  it('activate removes every cache from older versions', async () => {
    const sw = boot('public/sw.js', () => true)
    await sw.fire('install')
    sw.stores.set('pages-v1', new Map())
    sw.stores.set('static-v1', new Map())
    await sw.fire('activate')
    expect([...sw.stores.keys()]).toEqual(['offline-v2'])
  })

  it('kill switch (docs/sw-kill.js) clears every cache and unregisters', async () => {
    const sw = boot('docs/sw-kill.js', () => true)
    sw.stores.set('static-v2', new Map())
    await sw.fire('activate')
    expect(sw.stores.size).toBe(0)
    expect(sw.unregistered()).toBe(true)
  })

  it('serves /sw.js with no-cache', () => {
    expect(readFileSync('next.config.ts', 'utf8')).toMatch(/source: '\/sw\.js'[\s\S]*no-cache/)
  })
})
