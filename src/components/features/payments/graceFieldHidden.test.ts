import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('DEB-11: no card setting that no calculation reads', () => {
  it('the card setup sheet does not offer grace days (gracePeriodDays is stored but unused)', () => {
    const src = readFileSync(join(__dirname, 'PaymentMethodSetupSheet.tsx'), 'utf8')
    expect(src).not.toMatch(/ccGrace|ccGraceDays|gracePeriodDays/)
  })
})
