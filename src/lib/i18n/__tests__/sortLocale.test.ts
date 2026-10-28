import { describe, expect, it } from 'vitest'
import { sortByLabel } from '../sortLocale'

describe('sortByLabel', () => {
  it('orders Arabic labels alphabetically in Arabic', () => {
    const names = ['مصر', 'الإمارات', 'السعودية', 'الأردن']
    const sorted = sortByLabel(names, (n) => n, 'ar')
    expect(sorted).toEqual(['الأردن', 'الإمارات', 'السعودية', 'مصر'].sort((a, b) => new Intl.Collator('ar-EG').compare(a, b)))
    expect(sorted[sorted.length - 1]).toBe('مصر')
  })
  it('does not mutate and keeps English order for en', () => {
    const src = ['b', 'a']
    expect(sortByLabel(src, (x) => x, 'en')).toEqual(['a', 'b'])
    expect(src).toEqual(['b', 'a'])
  })
})
