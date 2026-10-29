import { describe, expect, it } from 'vitest'
import { shortDate } from '@/lib/utils/shortDate'
import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { getPaymentMethodBreakdown } from '@/lib/utils/calculations'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import type { Expense } from '@/lib/store/types'

describe('shortDate', () => {
  it('keeps the English label unchanged and defaults to English', () => {
    expect(shortDate('2026-09-22')).toBe('Sep 22')
    expect(shortDate('2026-09-22T10:00:00Z', 'en')).toBe('Sep 22')
  })

  it('renders the Arabic month name with Latin digits', () => {
    const out = shortDate('2026-09-22', 'ar')
    expect(out).toContain('سبتمبر')
    expect(out).toContain('22')
    expect(out).not.toMatch(/[٠-٩]/)
  })
})

describe('categoryLabel', () => {
  it('localizes known categories and passes custom ones through', () => {
    expect(categoryLabel(en, 'Food')).toBe('Food')
    expect(categoryLabel(ar, 'Food')).toBe('طعام')
    expect(categoryLabel(ar, 'Groceries')).toBe('بقالة')
    expect(categoryLabel(ar, 'My Custom')).toBe('My Custom')
  })
})

describe('getPaymentMethodBreakdown unknown label', () => {
  const e = { id: '1', amount: 10, currency: 'USD', paymentMethodId: 'gone', category: 'Food', date: '2026-09-01' } as unknown as Expense
  it('uses the localized label for expenses without a known method', () => {
    expect(getPaymentMethodBreakdown([e], [], 'USD', {}, ar.common.unknown)[0].name).toBe('غير معروف')
    expect(getPaymentMethodBreakdown([e], [], 'USD', {})[0].name).toBe('Unknown')
  })
})
