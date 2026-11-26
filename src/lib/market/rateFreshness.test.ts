import { describe, expect, it } from 'vitest'
import { LIVE_RATE_MAX_AGE_MS, hasLiveRate, ratesNeedFetch, stampRateKeys } from './rateFreshness'

const NOW = Date.parse('2026-11-25T12:00:00Z')
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

describe('hasLiveRate: a conversion counts as live only when today’s fetch priced it', () => {
  it('the same currency never needs a rate', () => {
    expect(hasLiveRate('EGP', 'EGP', {}, NOW)).toBe(true)
  })
  it('a pair the last fetch returned is live', () => {
    expect(hasLiveRate('USD', 'EGP', { USD_EGP: at(60_000) }, NOW)).toBe(true)
  })
  it('the reverse key counts too', () => {
    expect(hasLiveRate('EGP', 'USD', { USD_EGP: at(60_000) }, NOW)).toBe(true)
  })
  it('a pair never fetched is missing (only the built-in fallback could price it)', () => {
    expect(hasLiveRate('USD', 'EGP', {}, NOW)).toBe(false)
    expect(hasLiveRate('EUR', 'EGP', { USD_EGP: at(0) }, NOW)).toBe(false)
  })
  it('a pair older than a day is missing', () => {
    expect(hasLiveRate('USD', 'EGP', { USD_EGP: at(LIVE_RATE_MAX_AGE_MS + 1) }, NOW)).toBe(false)
    expect(hasLiveRate('USD', 'EGP', { USD_EGP: at(LIVE_RATE_MAX_AGE_MS - 1) }, NOW)).toBe(true)
  })
  it('stablecoins are priced as USD', () => {
    expect(hasLiveRate('USDT', 'EGP', { USD_EGP: at(0) }, NOW)).toBe(true)
    expect(hasLiveRate('EGP', 'USDC', { USD_EGP: at(0) }, NOW)).toBe(true)
    expect(hasLiveRate('USDT', 'USD', {}, NOW)).toBe(true)
  })
  it('an unreadable stamp is missing', () => {
    expect(hasLiveRate('USD', 'EGP', { USD_EGP: 'nope' }, NOW)).toBe(false)
  })
})

describe('stampRateKeys: each fetch dates only the keys it returned', () => {
  it('a key the newer fetch left out keeps its old stamp and so ages out', () => {
    const first = stampRateKeys({}, { USD_EGP: 48.5, USD_EUR: 0.92 }, at(LIVE_RATE_MAX_AGE_MS + 10))
    const second = stampRateKeys(first, { USD_EGP: 48.6 }, at(0))
    expect(second.USD_EGP).toBe(at(0))
    expect(hasLiveRate('USD', 'EUR', second, NOW)).toBe(false)
    expect(hasLiveRate('USD', 'EGP', second, NOW)).toBe(true)
  })
  it('a rate that is not a positive number is not stamped', () => {
    expect(stampRateKeys({}, { USD_EGP: 0, USD_SAR: Number.NaN }, at(0))).toEqual({})
  })
})

describe('ratesNeedFetch', () => {
  const TTL = 4 * 60 * 60 * 1000
  it('a store from before per-pair stamps fetches even with a fresh lastRatesFetch', () => {
    expect(ratesNeedFetch(at(60_000), {}, NOW, TTL)).toBe(true)
  })
  it('fresh and stamped needs nothing; stale or never fetched does', () => {
    expect(ratesNeedFetch(at(60_000), { USD_EGP: at(60_000) }, NOW, TTL)).toBe(false)
    expect(ratesNeedFetch(at(TTL + 1), { USD_EGP: at(TTL + 1) }, NOW, TTL)).toBe(true)
    expect(ratesNeedFetch(null, { USD_EGP: at(0) }, NOW, TTL)).toBe(true)
  })
})
