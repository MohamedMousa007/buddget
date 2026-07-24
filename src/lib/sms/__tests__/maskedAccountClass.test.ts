import { describe, it, expect } from 'vitest'
import { MASKED_ACCOUNT_CLASS } from '../aiParserPrompt'

/**
 * Every masked account/card form the real corpus contains. The regex-learning prompt tells
 * Gemini to substitute this class wherever one appears, and Gemini's output is validated
 * against its own sample before the template is stored — so a class that cannot match one of
 * these silently costs three Gemini retries and yields no template at all.
 */
const REAL_MASKS = [
  '103-104***-110', // HSBC statement family — the hyphens that broke [\d*]+
  '103-104***-001',
  '507803******6685', // NBE / Instapay card
  '********0001', // HSBC account
  '********3704',
  '**6774', // Saudi Mada / VISA
  '*8639',
  'XXXX2939'.replace(/X/g, '*'),
  '4203',
]

describe('MASKED_ACCOUNT_CLASS', () => {
  const re = new RegExp(`^${MASKED_ACCOUNT_CLASS}$`)

  it.each(REAL_MASKS)('matches %s in full', (mask) => {
    expect(re.test(mask)).toBe(true)
  })

  it('reproduces the learned regex that used to fail against its own sample', () => {
    const body =
      'From HSBC: 20JUL26 TT Payment to 103-104***-110 USD 3,097.24+ Your available balance is USD 7,546.11'
    const learned = new RegExp(
      `From\\s+HSBC:\\s+(\\S+)\\s+TT\\s+Payment\\s+to\\s+(${MASKED_ACCOUNT_CLASS})\\s+USD\\s+([\\d,]+\\.?\\d+)\\+`,
    )
    const m = learned.exec(body)
    expect(m).not.toBeNull()
    expect(m![2]).toBe('103-104***-110')
    expect(m![3]).toBe('3,097.24')
  })

  it('still fails with the old class, proving the fix is the hyphen', () => {
    expect(new RegExp('^[\\d*]+$').test('103-104***-110')).toBe(false)
  })
})
