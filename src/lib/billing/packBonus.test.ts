import { describe, expect, it } from 'vitest'
import { bonusSparks, packBonusPercent, refundClawback } from './packBonus'

describe('packBonusPercent', () => {
  it('Free and the trial get no bonus', () => {
    expect(packBonusPercent(false, 'founder')).toBe(0)
    expect(packBonusPercent(false, null)).toBe(0)
  })
  it('Pro gets 15%, Pro at Diamond or above 20%: the max, never added', () => {
    expect(packBonusPercent(true, 'silver')).toBe(15)
    expect(packBonusPercent(true, 'emerald')).toBe(15)
    expect(packBonusPercent(true, 'diamond')).toBe(20)
    expect(packBonusPercent(true, 'elite')).toBe(20)
    expect(packBonusPercent(true, 'founder')).toBe(20)
  })
})

describe('bonus Sparks and the refund clawback', () => {
  it('rounds down like the server', () => {
    expect(bonusSparks(320, 15)).toBe(48)
    expect(bonusSparks(125, 15)).toBe(18)
    expect(bonusSparks(2000, 20)).toBe(400)
  })
  it('a refund removes the unspent Sparks, bonus included', () => {
    const credited = 650 + bonusSparks(650, 20)
    expect(refundClawback(credited, 0)).toBe(780)
    expect(refundClawback(credited, 100)).toBe(680)
    expect(refundClawback(credited, 900)).toBe(0)
  })
})
