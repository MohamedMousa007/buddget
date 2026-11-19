import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildCsp } from './csp'

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

const PROJECT = 'https://abcdefghij.supabase.co'
beforeAll(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `${PROJECT}/`))
afterAll(() => vi.unstubAllEnvs())

describe('buildCsp', () => {
  it('script-src is nonce + strict-dynamic with no unsafe-inline or unsafe-eval', () => {
    const script = directive(buildCsp('abc123'), 'script-src')
    expect(script).toContain("'nonce-abc123'")
    expect(script).toContain("'strict-dynamic'")
    expect(script).not.toContain('unsafe-inline')
    expect(script).not.toContain('unsafe-eval')
  })

  it('keeps the hard lockdown directives', () => {
    const csp = buildCsp('abc123')
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(directive(csp, 'default-src')).toBe("default-src 'self'")
  })

  it('connect-src lists only hosts the browser calls (price, rate and AI calls go through own routes)', () => {
    const connect = directive(buildCsp('abc123'), 'connect-src')
    for (const host of ['generativelanguage.googleapis.com', 'open.er-api.com', 'frankfurter', 'metals.live', 'gold-api.com']) expect(connect).not.toContain(host)
  })

  it('QA-100: connect-src names the configured Supabase project only, over https and wss', () => {
    const connect = directive(buildCsp('abc123'), 'connect-src')
    expect(connect).toContain(PROJECT)
    expect(connect).toContain('wss://abcdefghij.supabase.co')
    expect(connect).not.toContain('*.supabase.co')
  })

  it('QA-100: img-src has no bare https: outside the admin portal, and allows the project storage', () => {
    const img = directive(buildCsp('abc123'), 'img-src')
    expect(img.split(' ')).not.toContain('https:')
    expect(img).toContain(PROJECT)
    expect(directive(buildCsp('abc123', true), 'img-src').split(' ')).toContain('https:')
  })

  it('embeds a fresh nonce per call', () => {
    expect(buildCsp('x')).not.toBe(buildCsp('y'))
  })
})
