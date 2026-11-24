import { describe, expect, it } from 'vitest'
import { standingCopies, isLaterCopy, isSamePhoneRecapture, secondCopyVerdict, SECOND_COPY_WINDOW_MS, type CopyRow } from './captureGuard'
import { extractIpnReference } from './dispatch'
import { extractBalance } from './balanceReport'

const row = (id: string, received_at: string, captured_at: string | null = received_at): CopyRow => ({ id, status: 'confirmed', received_at, captured_at, expense_id: `e-${id}`, income_id: null })

describe('secondCopyVerdict (I5)', () => {
  const withRef = 'Transfer of EGP 500.00 sent to a friend, reference b3abc23f at 10:15'
  const withBalance = 'Purchase EGP 99.00 at Test Shop. Available balance EGP 4,201.50'
  const timeOnly = 'Purchase EGP 99.00 at Test Shop 10:15'
  const verdictOf = (text: string) => secondCopyVerdict({ hasReference: extractIpnReference(text) != null, hasBalance: extractBalance(text) != null })

  it('a payment reference proves the same movement', () => expect(verdictOf(withRef)).toBe('proven_duplicate'))
  it('a running balance proves the same movement', () => expect(verdictOf(withBalance)).toBe('proven_duplicate'))
  it('a printed time of day proves nothing: the later copy is booked and flagged', () => expect(verdictOf(timeOnly)).toBe('possible_duplicate'))
  // BUD-104: a Saudi incoming transfer printing date, minute, both account tails and the amount, and nothing else.
  const saudiTransfer = 'Incoming transfer SAR 1,250.00 to **4821 from **9137 on 15/11/26 19:23'
  it('date + minute + account tails + amount is not proof: the later copy is booked and flagged', () =>
    expect(verdictOf(saudiTransfer)).toBe('possible_duplicate'))
  it('the same transfer with a reference is proof', () =>
    expect(verdictOf(`${saudiTransfer} reference b3abc23f`)).toBe('proven_duplicate'))
})

describe('isLaterCopy', () => {
  it('orders by receive time', () => {
    expect(isLaterCopy({ id: 'a', received_at: '2026-10-01T10:00:40Z' }, { id: 'z', received_at: '2026-10-01T10:00:00Z' })).toBe(true)
    expect(isLaterCopy({ id: 'z', received_at: '2026-10-01T10:00:00Z' }, { id: 'a', received_at: '2026-10-01T10:00:40Z' })).toBe(false)
  })
  it('reads timestamps of different spellings as the same instant', () => {
    expect(isLaterCopy({ id: 'b', received_at: '2026-10-01T10:00:00+03:00' }, { id: 'a', received_at: '2026-10-01T07:00:00.000Z' })).toBe(true)
  })
  it('two requests at the same instant: exactly one is the later copy', () => {
    const x = { id: '0000-aaaa', received_at: '2026-10-01T10:00:00Z' }
    const y = { id: '0000-bbbb', received_at: '2026-10-01T10:00:00Z' }
    expect([isLaterCopy(x, y), isLaterCopy(y, x)].filter(Boolean)).toHaveLength(1)
  })
})

describe('standingCopies (I5)', () => {
  const self = { id: 'me', received_at: '2026-10-01T10:00:40Z', captured_at: '2026-10-01T10:00:40.000Z' }
  it('lists an earlier capture of the text inside the window', () => {
    expect(standingCopies(self, [row('x', '2026-10-01T10:00:00Z')]).map((r) => r.id)).toEqual(['x'])
  })
  it('does not list a copy outside the window (four identical texts on four days)', () => {
    const days = [1, 2, 3, 4].map((d) => row(`d${d}`, `2026-09-0${d}T10:00:40Z`))
    expect(standingCopies(self, days)).toEqual([])
    expect(SECOND_COPY_WINDOW_MS).toBe(180_000)
  })
  it('lists a finished copy captured later: the earlier capture arriving second is the second copy', () => {
    expect(standingCopies(self, [row('x', '2026-10-01T10:01:10Z')]).map((r) => r.id)).toEqual(['x'])
  })
  it('two simultaneous processing rows: exactly one of them is the copy', () => {
    const a = { id: 'a', received_at: '2026-10-01T10:00:00Z', captured_at: '2026-10-01T10:00:00.000Z' }
    const b = { id: 'b', received_at: '2026-10-01T10:00:05Z', captured_at: '2026-10-01T10:00:05.000Z' }
    const inFlight = (r: typeof a): CopyRow => ({ ...r, status: 'processing', expense_id: null, income_id: null })
    const standsDown = [standingCopies(a, [inFlight(b)]).length, standingCopies(b, [inFlight(a)]).length]
    expect(standsDown.sort()).toEqual([0, 1])
  })
  it('does not list a row with the same known capture second', () => {
    expect(standingCopies(self, [row('x', '2026-10-01T10:00:00Z', '2026-10-01T10:00:40.000Z')])).toEqual([])
  })
  it('lists a row with no known capture time', () => {
    expect(standingCopies(self, [row('x', '2026-10-01T10:00:00Z', null)]).map((r) => r.id)).toEqual(['x'])
  })
  it('never lists itself', () => {
    expect(standingCopies(self, [row('me', '2026-10-01T10:00:00Z')])).toEqual([])
  })
})

describe('isSamePhoneRecapture (BUD-104)', () => {
  const other = { device_id: 'dev-1', sender: '', received_at: '2026-11-15T16:23:11Z' }
  const self = (over: Partial<{ deviceId: string | null; sender: string | null; receivedAt: string }> = {}) =>
    ({ deviceId: 'dev-1', sender: null, receivedAt: '2026-11-15T16:23:28Z', ...over })

  it('the same phone, no sender, 17 s apart', () => expect(isSamePhoneRecapture(self(), other)).toBe(true))
  it('another phone is not', () => expect(isSamePhoneRecapture(self({ deviceId: 'dev-2' }), other)).toBe(false))
  it('an unknown phone is not', () => expect(isSamePhoneRecapture(self({ deviceId: null }), { ...other, device_id: null })).toBe(false))
  it('a named sender is the Android path, not a Shortcut double-fire', () => expect(isSamePhoneRecapture(self({ sender: 'SNB' }), other)).toBe(false))
  it('a minute apart is not', () => expect(isSamePhoneRecapture(self({ receivedAt: '2026-11-15T16:24:12Z' }), other)).toBe(false))
})
