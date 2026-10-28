import type { ReactNode } from 'react'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'
import { SiteAnalytics } from './SiteAnalytics'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { StickyCta } from './StickyCta'

export function SiteShell({ locale, slug, children }: { locale: SiteLocale; slug: string; children: ReactNode }) {
  const c = siteContent[locale]
  const home = slug === ''
  return (
    <div className={`hm${home ? '' : ' hm-page'}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-card focus:px-4 focus:py-3 focus:shadow-[var(--shadow-lg)]">{c.nav.skip}</a>
      <SiteAnalytics />
      <SiteNav locale={locale} slug={slug} />
      <main id="main" className={home ? undefined : 'pt-[84px]'}>{children}</main>
      <SiteFooter locale={locale} />
      <StickyCta locale={locale} />
    </div>
  )
}
