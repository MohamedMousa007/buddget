import type { ReactNode } from 'react'
import Link from 'next/link'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'

export function SiteShell({ locale, slug, children }: { locale: SiteLocale; slug: string; children: ReactNode }) {
  const c = siteContent[locale]
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-card focus:px-4 focus:py-3 focus:shadow-[var(--shadow-lg)]">{c.nav.skip}</a>
      {slug === '' ? (
        <div className="bg-brand-primary px-4 py-2.5 text-center text-sm font-semibold text-brand-on-primary">
          <Link href={pathFor(locale, c.announce.slug)} className="inline-flex min-h-11 items-center hover:underline">{c.announce.text} <span aria-hidden className="ms-1 rtl:rotate-180">→</span></Link>
        </div>
      ) : null}
      <SiteNav locale={locale} slug={slug} />
      <main id="main">{children}</main>
      <SiteFooter locale={locale} />
    </>
  )
}
