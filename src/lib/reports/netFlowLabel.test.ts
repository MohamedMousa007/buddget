import { describe, expect, it } from 'vitest'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

describe('RPW-8: net cash flow is computed from expected income and says so', () => {
  it('both languages mark it expected, like "Money in (expected)"', () => {
    expect(en.reports.kpiNetCashFlow).toMatch(/expected/i)
    expect(ar.reports.kpiNetCashFlow).toContain('المتوقع')
  })
})
