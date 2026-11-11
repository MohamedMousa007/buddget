import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { AUTH_SCOPED_CACHES, clearAuthCaches } from './clearAuthCaches'

const sw = readFileSync('public/sw.js', 'utf8')

describe('SUP-3 service-worker caching of authenticated API responses', () => {
  it('never handles /api/ requests, so they always go to the network', () => {
    expect(sw).toContain("url.pathname.startsWith('/api/')) return")
    expect(sw).not.toMatch(/caches\.[a-z]+\([^)]*api/i)
  })
  it('is a committed static file, with no build-time service-worker dependency', () => {
    const pkg = readFileSync('package.json', 'utf8')
    for (const dep of ['next-pwa', 'serwist', 'workbox']) expect(pkg).not.toContain(dep)
  })
  it('sign-out clears the cache storage entries that can hold user data', async () => {
    const deleted: string[] = []
    vi.stubGlobal('caches', { delete: async (n: string) => { deleted.push(n); return true } })
    await clearAuthCaches()
    expect(deleted.sort()).toEqual([...AUTH_SCOPED_CACHES].sort())
    expect(AUTH_SCOPED_CACHES).toContain('apis')
    vi.unstubAllGlobals()
  })
  it('clearBudgetData (sign-out, session loss, account switch) triggers the cache clear', () => {
    expect(readFileSync('src/lib/auth/clearBudgetData.ts', 'utf8')).toContain('void clearAuthCaches()')
  })
})
