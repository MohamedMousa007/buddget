import { describe, expect, it } from 'vitest'
import { decideReset } from './resetEpoch'

describe('decideReset', () => {
  it('adopts the stamp on a device that never recorded one, without wiping', () => {
    expect(decideReset(null, null)).toBe('init')
    expect(decideReset(null, '2026-10-20T10:00:00+00:00')).toBe('init')
  })
  it('wipes when the server stamp is newer than the one this device honoured', () => {
    expect(decideReset('', '2026-10-20T10:00:00+00:00')).toBe('wipe')
    expect(decideReset('2026-10-20T10:00:00+00:00', '2026-10-21T08:00:00.123456+00:00')).toBe('wipe')
  })
  it('leaves a device alone when it is up to date or the account was never reset', () => {
    expect(decideReset('', null)).toBe('none')
    expect(decideReset('2026-10-20T10:00:00+00:00', '2026-10-20T10:00:00+00:00')).toBe('none')
    expect(decideReset('2026-10-21T10:00:00+00:00', '2026-10-20T10:00:00+00:00')).toBe('none')
  })
  it('ignores a stamp it cannot read', () => {
    expect(decideReset('', 'not a date')).toBe('none')
  })
})
