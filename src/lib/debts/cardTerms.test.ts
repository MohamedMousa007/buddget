import { describe, expect, it } from 'vitest'
import { cardDayError, clampCardDay, clampCardPercent, parseCardDay, parseCardPercent } from './cardTerms'

describe('card terms', () => {
  it('accepts only days 1-31', () => {
    expect(['0', '00', '32', '45', '99', '1.5', 'x'].map(parseCardDay)).toEqual([null, null, null, null, null, null, null])
    expect(['1', '15', '31'].map(parseCardDay)).toEqual([1, 15, 31])
  })
  it('accepts only percent 0-100', () => {
    expect(parseCardPercent('101')).toBeNull()
    expect(parseCardPercent('-1')).toBeNull()
    expect(parseCardPercent('0')).toBe(0)
    expect(parseCardPercent('5.5')).toBe(5.5)
  })
  it('blank is not an error, bad values are', () => {
    expect(cardDayError('')).toBe(false)
    expect(cardDayError('45')).toBe(true)
  })
  it('mapper clamps to the DB range', () => {
    expect(clampCardDay(45)).toBe(31)
    expect(clampCardDay(0)).toBe(1)
    expect(clampCardDay(undefined)).toBeNull()
    expect(clampCardPercent(250)).toBe(100)
    expect(clampCardPercent(-3)).toBe(0)
  })
})
