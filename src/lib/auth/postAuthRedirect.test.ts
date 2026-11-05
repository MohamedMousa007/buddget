import { describe, expect, it } from 'vitest'
import { safeInternalPath } from '@/lib/auth/postAuthRedirect'

describe('safeInternalPath', () => {
  it('keeps same-site paths', () => {
    expect(safeInternalPath('/flow')).toBe('/flow')
    expect(safeInternalPath('/flow?tab=1')).toBe('/flow?tab=1')
  })
  it.each(['//evil.com', '/\\evil.com', '/\t/evil.com', 'https://evil.com', '', null, undefined])('refuses %j', (p) => {
    expect(safeInternalPath(p)).toBe('/')
  })
})
