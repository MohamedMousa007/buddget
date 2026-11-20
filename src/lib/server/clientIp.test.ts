import { describe, expect, it } from 'vitest'
import { clientIp, rateBucketIp } from './clientIp'

const req = (h: Record<string, string>) => new Request('http://x', { headers: h })

describe('clientIp (AUT-7 / SST-10)', () => {
  it('prefers the platform-set x-real-ip over any forwarded hop', () => {
    expect(clientIp(req({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('9.9.9.9')
  })
  it('ignores the client-supplied first hop and takes the one our proxy appended', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.5' }))).toBe('203.0.113.5')
  })
  it('rotating the spoofed first hop does not change the bucket', () => {
    const buckets = new Set(Array.from({ length: 50 }, (_, i) => clientIp(req({ 'x-forwarded-for': `10.0.0.${i}, 203.0.113.5` }))))
    expect(buckets.size).toBe(1)
  })
  it('falls back to unknown', () => {
    expect(clientIp(req({}))).toBe('unknown')
  })
})

describe('rateBucketIp (S8A X-3)', () => {
  it('keeps an IPv4 address whole', () => {
    expect(rateBucketIp('203.0.113.5')).toBe('203.0.113.5')
  })
  it('folds every address inside one IPv6 /64 into one bucket, compressed or not', () => {
    const one = ['2001:db8:1:2::1', '2001:db8:1:2:ffff:0:0:9', '2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd'].map(rateBucketIp)
    expect(new Set(one).size).toBe(1)
    expect(rateBucketIp('2001:db8:1:3::1')).not.toBe(one[0])
  })
  it('treats an IPv4-mapped address as IPv4, and leaves unknown alone', () => {
    expect(rateBucketIp('::ffff:203.0.113.5')).toBe('203.0.113.5')
    expect(rateBucketIp('unknown')).toBe('unknown')
  })
})
