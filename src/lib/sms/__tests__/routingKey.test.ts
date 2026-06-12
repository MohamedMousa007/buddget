import { describe, it, expect } from 'vitest'
import { detectHotline, lookupKeys, effectiveSender } from '@/lib/sms/routingKey'

describe('routingKey — effective sender derivation', () => {
  it('detects a known bank hotline as an opaque key', () => {
    expect(detectHotline('للمزيد اتصل علي 19888')).toBe('HOTLINE-19888')
    expect(detectHotline('contact 19666 for details')).toBe('HOTLINE-19666')
    expect(detectHotline('no hotline here')).toBeNull()
  })

  it('lookupKeys returns transport sender + hotline, deduped, empties dropped', () => {
    expect(lookupKeys('NBE', 'call 19888')).toEqual(['NBE', 'HOTLINE-19888'])
    // iOS bridge: empty sender → hotline alone keeps Tier-2 alive.
    expect(lookupKeys('', 'call 19888')).toEqual(['HOTLINE-19888'])
    // No sender and no hotline → broad-scan fallback in the route.
    expect(lookupKeys(null, 'no hotline')).toEqual([])
  })

  it('effectiveSender prefers the hotline so iOS and Android converge on one key', () => {
    // Same NBE SMS: Android (sender "NBE") and iOS (sender "") both key by hotline.
    expect(effectiveSender('NBE', 'call 19888', 'NBE')).toBe('HOTLINE-19888')
    expect(effectiveSender('', 'call 19888', null)).toBe('HOTLINE-19888')
    // No hotline → transport sender, then AI bank name, then null.
    expect(effectiveSender('CIB', 'no hotline', null)).toBe('CIB')
    expect(effectiveSender('', 'no hotline', 'QNB')).toBe('QNB')
    expect(effectiveSender('', 'no hotline', null)).toBeNull()
  })
})
