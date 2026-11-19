import { describe, expect, it } from 'vitest'
import { inviteCodeFromAppUrl } from './inviteLinks'

describe('inviteCodeFromAppUrl', () => {
  it('reads the code from an invite link', () => {
    expect(inviteCodeFromAppUrl('https://buddget.app/i/LAYLA-7K2')).toBe('LAYLA-7K2')
    expect(inviteCodeFromAppUrl('https://buddget.app/i/layla-7k2/')).toBe('LAYLA-7K2')
    expect(inviteCodeFromAppUrl('https://BUDDGET.app/i/AB-7K2?utm_source=x')).toBe('AB-7K2')
  })
  it('rejects other hosts, schemes and paths', () => {
    for (const url of [
      'https://evil.example/i/LAYLA-7K2',
      'https://buddget.app.evil.example/i/LAYLA-7K2',
      'https://my.buddget.app/i/LAYLA-7K2',
      'http://buddget.app/i/LAYLA-7K2',
      'app.buddget://i/LAYLA-7K2',
      'https://buddget.app/auth/callback?code=1',
      'https://buddget.app/i/LAYLA-7K2/extra',
      'https://user@buddget.app/i/LAYLA-7K2',
    ]) expect(inviteCodeFromAppUrl(url), url).toBeNull()
  })
  it('rejects malformed codes and garbage', () => {
    expect(inviteCodeFromAppUrl('https://buddget.app/i/not a code')).toBeNull()
    expect(inviteCodeFromAppUrl('https://buddget.app/i/')).toBeNull()
    expect(inviteCodeFromAppUrl('https://buddget.app/i/%E0%A4%A')).toBeNull()
    expect(inviteCodeFromAppUrl('not a url')).toBeNull()
    expect(inviteCodeFromAppUrl('')).toBeNull()
    expect(inviteCodeFromAppUrl(undefined)).toBeNull()
  })
})
