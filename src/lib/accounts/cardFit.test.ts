import { describe, expect, it } from 'vitest'
import { DEFAULT_STACK_OFFSET, fitsInRow, stackOffset, stackWidth } from './cardFit'

// Room = card width − 32 (screen gutters) − 2 (border) − 32 (inner padding): 430 → 364, 390 → 324, 320 → 254.
const ROOM = { w430: 364, w390: 324, w320: 254 }

describe('fitsInRow (Stack geometry table)', () => {
  it('three faces + "3 cards" (332px) fit at 430 but stack at 390 and 320', () => {
    expect(fitsInRow(3, 44, ROOM.w430)).toBe(true)
    expect(fitsInRow(3, 44, ROOM.w390)).toBe(false)
    expect(fitsInRow(3, 44, ROOM.w320)).toBe(false)
  })
  it('four faces (428px) stack everywhere; two (235px) and one (130px) are a row everywhere', () => {
    expect(fitsInRow(4, 44, ROOM.w430)).toBe(false)
    expect(fitsInRow(2, 43, ROOM.w320)).toBe(true)
    expect(fitsInRow(1, 34, ROOM.w320)).toBe(true)
  })
  it('the boundary is inclusive', () => {
    expect(fitsInRow(3, 44, 332)).toBe(true)
    expect(fitsInRow(3, 44, 331)).toBe(false)
  })
})

describe('stackOffset', () => {
  it('is 52px until measured', () => {
    expect(stackOffset()).toBe(DEFAULT_STACK_OFFSET)
    expect(DEFAULT_STACK_OFFSET).toBe(52)
  })
  it('is the wider of kind label and digits plus 7px padding and 3px air', () => {
    expect(stackOffset({ kindW: 34, digitsW: 42 })).toBe(52)
    expect(stackOffset({ kindW: 61.2, digitsW: 42 })).toBe(72)
  })
  it('a 4-card stack at 52px is 244px wide', () => {
    expect(stackWidth(4, 52)).toBe(244)
  })
})
