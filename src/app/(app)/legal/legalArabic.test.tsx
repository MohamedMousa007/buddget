import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrivacyDataSections } from './privacy/sections/PrivacyDataSections'
import { PrivacyRightsSections } from './privacy/sections/PrivacyRightsSections'
import { PrivacyTechSections } from './privacy/sections/PrivacyTechSections'
import { PrivacyLegalSections } from './privacy/sections/PrivacyLegalSections'
import { PrivacyDataSectionsAr } from './privacy/sections/ar/PrivacyDataSections'
import { PrivacyRightsSectionsAr } from './privacy/sections/ar/PrivacyRightsSections'
import { PrivacyTechSectionsAr } from './privacy/sections/ar/PrivacyTechSections'
import { PrivacyLegalSectionsAr } from './privacy/sections/ar/PrivacyLegalSections'
import { TermsIntroSections } from './terms/sections/TermsIntroSections'
import { TermsUsageSections } from './terms/sections/TermsUsageSections'
import { TermsLiabilitySections } from './terms/sections/TermsLiabilitySections'
import { TermsLegalSections } from './terms/sections/TermsLegalSections'
import { TermsIntroSectionsAr } from './terms/sections/ar/TermsIntroSections'
import { TermsUsageSectionsAr } from './terms/sections/ar/TermsUsageSections'
import { TermsLiabilitySectionsAr } from './terms/sections/ar/TermsLiabilitySections'
import { TermsLegalSectionsAr } from './terms/sections/ar/TermsLegalSections'

const html = (nodes: React.ReactNode[]) => nodes.map((n) => renderToStaticMarkup(<>{n}</>)).join('')
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
const hrefs = (s: string) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort()
const arabicLetters = (s: string) => count(s.replace(/<[^>]+>/g, ''), /[؀-ۿ]/g)

const privacyEn = html([<PrivacyDataSections key="a" />, <PrivacyRightsSections key="b" />, <PrivacyTechSections key="c" />, <PrivacyLegalSections key="d" />])
const privacyAr = html([<PrivacyDataSectionsAr key="a" />, <PrivacyRightsSectionsAr key="b" />, <PrivacyTechSectionsAr key="c" />, <PrivacyLegalSectionsAr key="d" />])
const termsEn = html([<TermsIntroSections key="a" />, <TermsUsageSections key="b" />, <TermsLiabilitySections key="c" />, <TermsLegalSections key="d" />])
const termsAr = html([<TermsIntroSectionsAr key="a" />, <TermsUsageSectionsAr key="b" />, <TermsLiabilitySectionsAr key="c" />, <TermsLegalSectionsAr key="d" />])

describe.each([
  ['privacy', privacyEn, privacyAr, 13],
  ['terms', termsEn, termsAr, 17],
])('Arabic %s mirrors the English document (SIT8)', (_name, en, ar, sections) => {
  it('has every numbered section, list item and link of the English text', () => {
    expect(count(ar, /<section/g)).toBe(sections)
    expect(count(en, /<section/g)).toBe(sections)
    expect(count(ar, /<li/g)).toBe(count(en, /<li/g))
    expect(count(ar, /<ul/g)).toBe(count(en, /<ul/g))
    expect(hrefs(ar)).toEqual(hrefs(en))
  })

  it('is written in Arabic, with no English body copy left', () => {
    expect(arabicLetters(ar)).toBeGreaterThan(arabicLetters(en) + 2000)
  })
})

describe('retention line for website leads (SIT9)', () => {
  it('states the 180-day deletion in both languages', () => {
    expect(privacyEn).toMatch(/waitlist[\s\S]{0,200}180 days/)
    expect(privacyAr).toMatch(/180 يومًا/)
    expect(privacyAr).toContain('رسائل الموقع وبريد قائمة الانتظار')
  })
})
