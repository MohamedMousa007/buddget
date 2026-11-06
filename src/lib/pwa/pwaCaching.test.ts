import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import rules from '../../../config/pwaRuntimeCaching.js'
import { AUTH_SCOPED_CACHES, clearAuthCaches } from './clearAuthCaches'

type Rule = { urlPattern: unknown; handler: string; options: { cacheName: string } }
const list = rules as Rule[]
const matches = (rule: Rule, href: string) =>
  typeof rule.urlPattern === 'function' ? Boolean((rule.urlPattern as (a: { url: URL }) => boolean)({ url: new URL(href) })) : false

describe('SUP-3 service-worker caching of authenticated API responses', () => {
  it('routes every /api/ GET to the network only, ahead of any other rule', () => {
    const first = list[0]!
    expect(first.handler).toBe('NetworkOnly')
    for (const p of ['/api/admin/users', '/api/notifications', '/api/entitlements/me', '/api/support/tickets', '/api/auth/session']) {
      expect(matches(first, `https://buddget.app${p}`), p).toBe(true)
    }
    expect(matches(first, 'https://buddget.app/flow')).toBe(false)
  })
  it('keeps no rule that stores /api/ responses', () => {
    expect(list.some((r) => r.options.cacheName === 'apis')).toBe(false)
    expect(list.length).toBeGreaterThan(5)
  })
  it('next.config wires the rules into next-pwa', () => {
    expect(readFileSync('next.config.ts', 'utf8')).toContain("runtimeCaching: require('./config/pwaRuntimeCaching')")
  })
  it('the generated service worker output is gitignored, not committed', () => {
    const ignore = readFileSync('.gitignore', 'utf8')
    for (const f of ['public/sw.js', 'public/workbox-*.js', 'public/worker-*.js', 'public/fallback-*.js']) expect(ignore).toContain(f)
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
