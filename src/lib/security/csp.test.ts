import { describe, expect, it } from 'vitest'
import { buildCsp } from './csp'

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('buildCsp', () => {
  const csp = buildCsp('abc123')
  const script = directive(csp, 'script-src')

  it('script-src is nonce + strict-dynamic with no unsafe-inline or unsafe-eval', () => {
    expect(script).toContain("'nonce-abc123'")
    expect(script).toContain("'strict-dynamic'")
    expect(script).not.toContain('unsafe-inline')
    expect(script).not.toContain('unsafe-eval')
  })

  it('keeps the hard lockdown directives', () => {
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(directive(csp, 'default-src')).toBe("default-src 'self'")
  })

  it('embeds a fresh nonce per call', () => {
    expect(buildCsp('x')).not.toBe(buildCsp('y'))
  })
})
