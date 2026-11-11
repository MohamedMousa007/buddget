import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLocaleCookie } from '@/lib/i18n/localeCookie'

describe('A11-20 first-paint language', () => {
  it('only ar selects Arabic; anything else is English', () => {
    expect(parseLocaleCookie('ar')).toBe('ar')
    expect(parseLocaleCookie('en')).toBe('en')
    expect(parseLocaleCookie(undefined)).toBe('en')
    expect(parseLocaleCookie('fr')).toBe('en')
  })
  it('the root layout reads the cookie instead of hard-coding lang="en"', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')
    expect(src).toContain('lang={locale}')
    expect(src).not.toContain('<html lang="en"')
    expect(src).toContain('LOCALE_COOKIE')
  })
  it('the provider writes the cookie when the language changes', () => {
    expect(readFileSync(join(process.cwd(), 'src/lib/i18n/index.tsx'), 'utf8')).toContain('writeLocaleCookie(locale)')
  })
})
