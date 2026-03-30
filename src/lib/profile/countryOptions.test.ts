import { describe, expect, it } from 'vitest'
import {
  PROFILE_COUNTRY_OPTIONS,
  countryNameEnFromCode,
  resolveProfileCountryToCode,
} from './countryOptions'

describe('countryOptions', () => {
  it('excludes Israel (IL)', () => {
    expect(PROFILE_COUNTRY_OPTIONS.some((o) => o.code === 'IL')).toBe(false)
  })

  it('includes United States', () => {
    expect(PROFILE_COUNTRY_OPTIONS.some((o) => o.code === 'US')).toBe(true)
  })

  it('resolves English name to code for select', () => {
    const us = PROFILE_COUNTRY_OPTIONS.find((o) => o.code === 'US')
    expect(us).toBeDefined()
    expect(resolveProfileCountryToCode(us!.nameEn)).toBe('US')
  })

  it('resolves alpha-2 code', () => {
    expect(resolveProfileCountryToCode('AE')).toBe('AE')
  })

  it('countryNameEnFromCode returns stored shape', () => {
    expect(countryNameEnFromCode('FR')).toMatch(/France/i)
  })
})
