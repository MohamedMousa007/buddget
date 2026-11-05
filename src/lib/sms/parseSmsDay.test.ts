import { describe, expect, it } from 'vitest'
import { parseSmsDay } from '@/lib/sms/parseSmsDay'

describe('parseSmsDay year-first dates', () => {
  it('reads 26/07/30 received 2026-07-30 as 2026-07-30, not a 2030 date', () => {
    expect(parseSmsDay('26/07/30', '2026-07-30T10:00:00Z')).toBe('2026-07-30')
  })
  it('still reads an ordinary dd/mm/yy', () => {
    expect(parseSmsDay('30/07/26', '2026-07-30T10:00:00Z')).toBe('2026-07-30')
  })
})