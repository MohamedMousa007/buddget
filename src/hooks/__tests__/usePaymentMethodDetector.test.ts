import { describe, it, expect } from 'vitest'
import { pickProvider } from '../usePaymentMethodDetector'

describe('pickProvider', () => {
  it('prefers a catalogue-resolvable sender over the parsed bank name', () => {
    // QNB never names itself in the body — the sender ID is the only signal.
    expect(pickProvider('QNB EGYPT', null)).toBe('QNB EGYPT')
    expect(pickProvider('QNB EGYPT', 'Bank')).toBe('QNB EGYPT')
  })

  it('never returns the generic-pattern placeholder or a numeric shortcode', () => {
    expect(pickProvider(null, 'Bank')).toBeNull()
    expect(pickProvider('19123', 'Bank')).toBeNull()
    expect(pickProvider(null, null)).toBeNull()
  })

  it('falls back to a real bank name when the sender is a shortcode', () => {
    expect(pickProvider('19888', 'NBE')).toBe('NBE')
  })

  it('falls back to an unresolvable sender when there is no bank name', () => {
    expect(pickProvider('SOME BANK', 'Bank')).toBe('SOME BANK')
  })
})
