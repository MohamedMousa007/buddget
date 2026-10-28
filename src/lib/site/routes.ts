import { SITE_URL, type SiteLocale } from './config'
import { en } from './content/en'
import { ar } from './content/ar'
import type { SiteContent } from './content/types'

export const siteContent: Record<SiteLocale, SiteContent> = { en, ar }

export type RouteMeta = {
  slug: string
  title: string
  description: string
  priority: number
  /** ISO date of the last content change, for the sitemap. */
  modified: string
}

const MODIFIED = '2026-10-28'

function clip(text: string, max = 155): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

function intro(slug: string, i: { h1: string; lede: string }, priority: number): RouteMeta {
  return { slug, title: i.h1, description: clip(i.lede), priority, modified: MODIFIED }
}

export function listRoutes(locale: SiteLocale): RouteMeta[] {
  const c = siteContent[locale]
  return [
    { slug: '', title: c.meta.homeTitle, description: c.meta.homeDescription, priority: 1, modified: MODIFIED },
    intro('features', c.features.intro, 0.9),
    ...c.features.items.map((f) => intro(`features/${f.slug}`, { h1: f.h1, lede: f.lede }, 0.8)),
    intro('how-it-works', c.how.intro, 0.8),
    intro('pricing', c.pricing.intro, 0.8),
    intro('download', c.download.intro, 0.9),
    intro('security', c.security.intro, 0.7),
    intro('support', c.support.intro, 0.7),
    intro('contact', c.contact.intro, 0.5),
    intro('about', c.about.intro, 0.5),
    intro('press', c.press.intro, 0.4),
    intro('ai', c.ai.intro, 0.5),
    intro('guides', c.guides.intro, 0.7),
    ...c.guides.items.map((g) => ({ slug: `guides/${g.slug}`, title: g.title, description: clip(g.description), priority: 0.6, modified: g.published })),
    intro('tools', c.tools.intro, 0.7),
    intro('tools/daily-spending-number', c.tools.daily.intro, 0.7),
    intro('tools/emergency-fund', c.tools.emergency.intro, 0.7),
    intro('delete-account', c.deleteAccount.intro, 0.4),
    intro('glossary', c.glossary.intro, 0.5),
    intro('compare/spreadsheet', c.compare.intro, 0.5),
    intro('cookies', c.cookies.intro, 0.3),
  ]
}

export function findRoute(locale: SiteLocale, slug: string): RouteMeta | undefined {
  return listRoutes(locale).find((r) => r.slug === slug)
}

export function pathFor(locale: SiteLocale, slug: string): string {
  return slug ? `/${locale}/${slug}` : `/${locale}`
}

export function urlFor(locale: SiteLocale, slug: string): string {
  return `${SITE_URL}${pathFor(locale, slug)}`
}
