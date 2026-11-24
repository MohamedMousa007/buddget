import { describe, expect, it } from 'vitest'
import { parseUserAgent } from './clientContext'

describe('parseUserAgent', () => {
  it('reads the Android version and model', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36'
    expect(parseUserAgent(ua)).toEqual({ osVersion: 'Android 14', device: 'SM-S918B' })
  })
  it('drops the reduced "K" model newer Chrome sends', () => {
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36').device).toBeUndefined()
  })
  it('reads iOS as version plus device family', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    expect(parseUserAgent(ua)).toEqual({ osVersion: 'iOS 17.4.1', device: 'iPhone' })
  })
  it('returns nothing for an unknown agent', () => {
    expect(parseUserAgent('curl/8')).toEqual({})
  })
})
