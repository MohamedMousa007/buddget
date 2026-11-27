import { describe, expect, it } from 'vitest'
import { placeOtpDigit } from './otp'

describe('placeOtpDigit (BUD-111)', () => {
  it('types digit by digit and moves focus on', () => {
    expect(placeOtpDigit('', 0, '6')).toEqual({ code: '6', focus: 1 })
    expect(placeOtpDigit('61613', 5, '2')).toEqual({ code: '616132', focus: 5 })
  })
  it('typing over a filled box replaces that digit instead of wiping the code', () => {
    expect(placeOtpDigit('616', 1, '17')).toEqual({ code: '676', focus: 2 })
    expect(placeOtpDigit('616', 1, '71')).toEqual({ code: '676', focus: 2 })
  })
  it('a digit typed past the first empty box lands in that box', () => {
    expect(placeOtpDigit('6', 4, '1')).toEqual({ code: '61', focus: 2 })
  })
  it('a full code in one box (autofill, QuickType) fills every box', () => {
    expect(placeOtpDigit('', 0, '616132')).toEqual({ code: '616132', focus: 5 })
    expect(placeOtpDigit('6', 0, '616132')).toEqual({ code: '616132', focus: 5 })
  })
  it('clearing a box removes its digit', () => {
    expect(placeOtpDigit('616', 2, '')).toEqual({ code: '61', focus: 2 })
  })
})
