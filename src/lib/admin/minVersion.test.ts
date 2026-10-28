import { describe, expect, it } from 'vitest'
import { APP_CLIENT_VERSION } from '@/lib/appVersion'
import { confirmsLockOut, exceedsLatestRelease } from './minVersion'

describe('exceedsLatestRelease', () => {
  it('accepts the latest release and anything older, or empty', () => {
    expect(exceedsLatestRelease('', '')).toBe(false)
    expect(exceedsLatestRelease(APP_CLIENT_VERSION, '0.9')).toBe(false)
  })
  it('flags a typo above the latest release', () => {
    expect(exceedsLatestRelease('11.0.0')).toBe(true)
    expect(exceedsLatestRelease('', '99')).toBe(true)
    expect(exceedsLatestRelease('1.1.1')).toBe(true)
  })
  it('needs the exact typed phrase', () => {
    expect(confirmsLockOut('LOCK OUT USERS')).toBe(true)
    expect(confirmsLockOut('lock out users')).toBe(false)
    expect(confirmsLockOut(undefined)).toBe(false)
  })
})
