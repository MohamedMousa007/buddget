import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { noteServerTime, reloadServerClock, resetServerClock, serverInstant, toServerTime } from './serverClock'

describe('serverClock', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } })
    resetServerClock()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ignores round-trip latency noise so a stamp converts to the same instant on every pull', () => {
    const now = Date.now()
    noteServerTime(new Date(now + 3_600_000).toISOString())
    const stamp = new Date(now - 60_000).toISOString()
    const first = toServerTime(stamp)
    noteServerTime(new Date(Date.now() + 3_600_000 - 700).toISOString())
    expect(toServerTime(stamp)).toBe(first)
  })

  it('follows a real clock change', () => {
    const now = Date.now()
    noteServerTime(new Date(now).toISOString())
    noteServerTime(new Date(now + 60_000).toISOString())
    expect(Math.abs((serverInstant(new Date(now - 1000).toISOString()) ?? 0) - (now - 1000 + 60_000))).toBeLessThan(500)
  })

  it('holds a device stamp from the future at the server’s now (OFS-1)', () => {
    const t = serverInstant(new Date(Date.now() + 86_400_000).toISOString()) as number
    expect(t).toBeLessThanOrEqual(Date.now() + 5)
  })

  it('leaves server stamps alone', () => {
    expect(Date.parse(toServerTime('2026-07-01T00:00:00+00:00'))).toBe(Date.parse('2026-07-01T00:00:00Z'))
  })

  describe('REG-7: a stored offset is only trusted while the device clock has not been corrected', () => {
    const store = () => window.localStorage
    it('is reused after a restart when fresh', () => {
      noteServerTime(new Date(Date.now() + 3_600_000).toISOString())
      reloadServerClock()
      expect(Math.abs((serverInstant(new Date().toISOString()) ?? 0) - (Date.now() + 3_600_000))).toBeLessThan(500)
    })

    it('is dropped when the device clock moved backwards since it was learned', () => {
      store().setItem('bdg-server-clock-offset-v2', JSON.stringify({ o: 3_600_000, at: Date.now() + 60_000 }))
      reloadServerClock()
      expect(Math.abs((serverInstant(new Date().toISOString()) ?? 0) - Date.now())).toBeLessThan(500)
    })

    it('is dropped when it is older than three days, and a legacy plain value is ignored', () => {
      store().setItem('bdg-server-clock-offset-v2', JSON.stringify({ o: 3_600_000, at: Date.now() - 4 * 86_400_000 }))
      reloadServerClock()
      expect(Math.abs((serverInstant(new Date().toISOString()) ?? 0) - Date.now())).toBeLessThan(500)
    })
  })
})
