import { describe, expect, it } from 'vitest'
import { isAllowedSmsApiUrl } from './smsApiUrl'

describe('SST-2 SMS API URL allow-list', () => {
  it('accepts https on buddget.app and its subdomains', () => {
    for (const u of ['https://buddget.app', 'https://buddget.app/', 'https://api.buddget.app', 'HTTPS://Buddget.App']) {
      expect(isAllowedSmsApiUrl(u, false), u).toBe(true)
    }
  })
  it('rejects look-alikes, userinfo tricks, other schemes, ports and paths', () => {
    for (const u of [
      '', '   ', 'buddget.app', 'http://buddget.app', 'https://evilbuddget.app', 'https://buddget.app.evil.com',
      'https://buddget.app@evil.com', 'https://evil.com/?h=buddget.app', 'https://evil.com#buddget.app', 'https://buddget.app:8443',
      'https://buddget.app/x', 'https://user:pw@buddget.app', 'javascript:alert(1)', 'ftp://buddget.app', 'https://app.test',
    ]) {
      expect(isAllowedSmsApiUrl(u, false), u).toBe(false)
    }
    expect(isAllowedSmsApiUrl(null, false)).toBe(false)
    expect(isAllowedSmsApiUrl(undefined, false)).toBe(false)
  })
  it('allows http://localhost only for development builds', () => {
    expect(isAllowedSmsApiUrl('http://localhost:3000', true)).toBe(true)
    expect(isAllowedSmsApiUrl('http://localhost:3000', false)).toBe(false)
    expect(isAllowedSmsApiUrl('http://evil.com', true)).toBe(false)
  })
})
