import { describe, expect, it } from 'vitest'
import { fitBigNumber, fitCellValue } from './fitText'

describe('hero fit text', () => {
  it('leaves ordinary figures at the default size', () => {
    expect(fitBigNumber('12,345.67')).toBe('text-[32px]')
    expect(fitBigNumber('123,456.78')).toBe('text-[32px]')
    expect(fitCellValue('-12,345')).toBe('text-base')
  })
  it('steps down for a 99,000,800.79 figure so it clears the per-day block', () => {
    expect(fitBigNumber('99,000,800.79')).toBe('text-[26px]')
    expect(fitBigNumber('-998,938,560.79')).toBe('text-[21px]')
    expect(fitCellValue('-99,000,801')).toBe('text-base')
    expect(fitCellValue('-99,000,800.79')).toBe('text-[12px]')
  })
})
