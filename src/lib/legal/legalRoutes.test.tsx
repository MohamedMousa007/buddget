import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sitemap from '@/app/sitemap'
import { SiteFooter } from '@/components/site/SiteFooter'
import { LegalLocaleProvider } from '@/components/legal/LegalLocale'
import { LegalFrame } from '@/components/legal/LegalFrame'
import { PrivacyDocument } from '@/app/(app)/legal/privacy/PrivacyDocument'
import { TermsDocument } from '@/app/(app)/legal/terms/TermsDocument'
import { metadata as arPrivacyMeta } from '@/app/(site-ar)/ar/legal/privacy/page'
import { metadata as arTermsMeta } from '@/app/(site-ar)/ar/legal/terms/page'
import { metadata as enPrivacyMeta } from '@/app/(app)/legal/privacy/page'
import { LEGAL_DOCS, legalAlternates, legalPath, legalUrl } from './paths'

const APP = join(__dirname, '../../app')

/** The URL every page.tsx serves: its folder path with the route groups removed. */
function routeTable(dir = APP, prefix = '', out = new Set<string>()): Set<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      const seg = /^\(.*\)$/.test(name) ? '' : `/${name}`
      routeTable(p, prefix + seg, out)
    } else if (/^page\.tsx?$/.test(name)) out.add(prefix || '/')
  }
  return out
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
const routes = routeTable()

describe('ADS-9 legal URLs per language', () => {
  it('maps each document to an English and an Arabic URL', () => {
    expect(legalPath('privacy', 'en')).toBe('/legal/privacy')
    expect(legalPath('terms', 'en')).toBe('/legal/terms')
    expect(legalPath('privacy', 'ar')).toBe('/ar/legal/privacy')
    expect(legalPath('terms', 'ar')).toBe('/ar/legal/terms')
  })

  it('every legal URL has a page in the route table', () => {
    for (const doc of LEGAL_DOCS) for (const l of ['en', 'ar'] as const) expect(routes.has(legalPath(doc, l)), legalPath(doc, l)).toBe(true)
  })

  it('the Arabic site footer links to the Arabic URLs, the English site to the English ones', () => {
    const ar = hrefs(renderToStaticMarkup(h(SiteFooter, { locale: 'ar' })))
    const en = hrefs(renderToStaticMarkup(h(SiteFooter, { locale: 'en' })))
    expect(ar).toContain('/ar/legal/privacy')
    expect(ar).toContain('/ar/legal/terms')
    expect(ar).not.toContain('/legal/privacy')
    expect(en).toContain('/legal/privacy')
    expect(en).toContain('/legal/terms')
    expect(en.filter((x) => x.includes('/ar/legal'))).toEqual([])
  })

  it('every legal link rendered by the footers and the frames resolves to a route', () => {
    const rendered = [
      renderToStaticMarkup(h(SiteFooter, { locale: 'ar' })),
      renderToStaticMarkup(h(SiteFooter, { locale: 'en' })),
      renderToStaticMarkup(<LegalLocaleProvider locale="ar"><LegalFrame>x</LegalFrame></LegalLocaleProvider>),
      renderToStaticMarkup(<LegalFrame>x</LegalFrame>),
    ].flatMap(hrefs)
    const legal = rendered.filter((x) => x.includes('/legal/'))
    expect(legal.length).toBeGreaterThanOrEqual(8)
    for (const href of legal) expect(routes.has(href), href).toBe(true)
  })

  it('the URL wins over the app setting: /ar/legal renders Arabic, right-to-left, with Arabic cross-links', () => {
    for (const [Doc, other] of [[PrivacyDocument, 'terms'], [TermsDocument, 'privacy']] as const) {
      const html = renderToStaticMarkup(<LegalLocaleProvider locale="ar"><Doc /></LegalLocaleProvider>)
      expect(html).toContain('lang="ar" dir="rtl"')
      expect(html).toMatch(/[؀-ۿ]{5}/)
      expect(hrefs(html)).toContain(`/ar/legal/${other}`)
      expect(hrefs(html)).not.toContain(`/legal/${other}`)
    }
  })

  it('without a locale in the URL the document follows the app setting (default English) and links stay language-neutral', () => {
    const html = renderToStaticMarkup(h(PrivacyDocument))
    expect(html).not.toContain('dir="rtl"')
    expect(hrefs(html)).toContain('/legal/terms')
  })

  it('page metadata carries hreflang alternates and a self canonical', () => {
    expect(arPrivacyMeta.alternates).toEqual(legalAlternates('privacy', 'ar'))
    expect(arTermsMeta.alternates).toEqual(legalAlternates('terms', 'ar'))
    expect(enPrivacyMeta.alternates).toEqual(legalAlternates('privacy', 'en'))
    const a = legalAlternates('terms', 'ar')
    expect(a.canonical).toBe('https://buddget.app/ar/legal/terms')
    expect(a.languages).toEqual({
      en: 'https://buddget.app/legal/terms',
      'ar-EG': 'https://buddget.app/ar/legal/terms',
      'x-default': 'https://buddget.app/legal/terms',
    })
  })

  it('the sitemap lists both languages of both documents, each with alternates', () => {
    const urls = sitemap()
    for (const doc of LEGAL_DOCS) {
      for (const l of ['en', 'ar'] as const) {
        const entry = urls.find((u) => u.url === legalUrl(doc, l))
        expect(entry, legalUrl(doc, l)).toBeDefined()
        expect(entry!.alternates?.languages).toEqual({ en: legalUrl(doc, 'en'), 'ar-EG': legalUrl(doc, 'ar') })
      }
    }
  })

  it('the Arabic legal pages are served as website pages (own CSP, indexable, robots allow)', async () => {
    const { isSitePath } = await import('@/lib/site/entry')
    expect(isSitePath('/ar/legal/privacy')).toBe(true)
    const robots = readFileSync(join(APP, 'robots.ts'), 'utf8')
    expect(robots).toContain("'/ar'")
  })

  it('the Arabic layout forces Arabic for its whole subtree', () => {
    const layout = join(APP, '(site-ar)/ar/legal/layout.tsx')
    expect(existsSync(layout)).toBe(true)
    expect(readFileSync(layout, 'utf8')).toContain('<LegalLocaleProvider locale="ar">')
  })
})
