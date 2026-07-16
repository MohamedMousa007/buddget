import { describe, it, expect } from 'vitest'
import { pickProvider } from '../usePaymentMethodDetector'
import { GENERIC_BANK_PATTERNS } from '@/lib/sms/patterns/genericBank'

describe('pickProvider', () => {
  it('prefers a catalogue-resolvable sender over the parsed bank name', () => {
    // QNB never names itself in the body — the sender ID is the only signal.
    expect(pickProvider('QNB EGYPT', null)).toBe('QNB Alahli')
    expect(pickProvider('QNB EGYPT', 'Bank')).toBe('QNB Alahli')
  })

  it('returns the catalogue name so the banner and the setup sheet agree', () => {
    // The sheet resolves the name again; a raw sender token would leave the
    // banner saying "QNB EGYPT" and the sheet "QNB Alahli".
    expect(pickProvider('qnb alahly', null)).toBe('QNB Alahli')
    expect(pickProvider(null, 'qnb egypt')).toBe('QNB Alahli')
  })

  it('never returns the generic-pattern placeholder or a numeric shortcode', () => {
    expect(pickProvider(null, 'Bank')).toBeNull()
    expect(pickProvider('19123', 'Bank')).toBeNull()
    expect(pickProvider(null, null)).toBeNull()
  })

  it('filters the placeholder the generic pattern set actually emits', () => {
    // pickProvider hardcodes 'Bank'; if the pattern set renames it, the filter
    // silently stops working and every generic SMS shows "Bank" as a provider.
    expect(GENERIC_BANK_PATTERNS.bank).toBe('Bank')
  })

  it('falls back to a real bank name when the sender is a shortcode', () => {
    expect(pickProvider('19888', 'NBE')).toBe('NBE')
  })

  it('passes through an unrecognised provider unchanged', () => {
    expect(pickProvider('SOME BANK', 'Bank')).toBe('SOME BANK')
  })
})
