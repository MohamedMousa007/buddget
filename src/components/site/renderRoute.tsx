import type { ReactNode } from 'react'
import type { SiteLocale } from '@/lib/site/config'
import { findRoute, siteContent } from '@/lib/site/routes'
import { articleLd, breadcrumbLd, faqLd, glossaryLd, graph, homeLd, howToLd, toolLd } from '@/lib/site/seo'
import {
  AboutPage, AiPage, ComparePage, ContactPage, CookiesPage, DailyToolPage, DeleteAccountPage, DownloadPage,
  EmergencyToolPage, FeaturePage, FeaturesHub, GlossaryPage, GuidePage, GuidesIndex, HomePage, HowPage,
  PressPage, PricingPage, SecurityPage, SupportPage, ToolsHub,
} from './pages'

export type Rendered = { node: ReactNode; ld: object }

function breadcrumbLabels(locale: SiteLocale, slug: string): string[] {
  const c = siteContent[locale]
  const [section, child] = slug.split('/')
  const sectionLabel: Record<string, string> = {
    features: c.footer.links.features, guides: c.footer.links.guides, tools: c.footer.links.tools,
    compare: c.footer.links.compare, 'how-it-works': c.footer.links.how, pricing: c.footer.links.pricing,
    download: c.footer.links.download, security: c.footer.links.security, support: c.footer.links.support,
    contact: c.footer.links.contact, about: c.footer.links.about, press: c.footer.links.press, ai: c.footer.links.ai,
    glossary: c.footer.links.glossary, cookies: c.footer.links.cookies, 'delete-account': c.footer.links.delete,
  }
  const childLabel =
    section === 'features' ? c.features.items.find((x) => x.slug === child)?.name
    : section === 'guides' ? c.guides.items.find((x) => x.slug === child)?.title
    : section === 'tools' ? c.tools.items.find((x) => x.slug === child)?.name
    : undefined
  return child ? [sectionLabel[section] ?? section, childLabel ?? child] : [sectionLabel[section] ?? section]
}

/** Resolves a slug to its page and structured data, or null when the route does not exist. */
export function renderRoute(locale: SiteLocale, slug: string): Rendered | null {
  if (!findRoute(locale, slug)) return null
  const c = siteContent[locale]
  const crumbs = slug ? breadcrumbLd(locale, slug, breadcrumbLabels(locale, slug)) : null
  const [section, child] = slug.split('/')

  switch (section) {
    case '':
      return { node: <HomePage locale={locale} />, ld: graph(homeLd(locale)) }
    case 'features':
      return child
        ? { node: <FeaturePage locale={locale} slug={child} />, ld: graph([crumbs, faqLd(c.features.items.find((x) => x.slug === child)?.faq ?? [])]) }
        : { node: <FeaturesHub locale={locale} />, ld: graph([crumbs]) }
    case 'how-it-works':
      return { node: <HowPage locale={locale} />, ld: graph([crumbs, howToLd(locale)]) }
    case 'pricing':
      return { node: <PricingPage locale={locale} />, ld: graph([crumbs, faqLd(c.pricing.faq)]) }
    case 'download':
      return { node: <DownloadPage locale={locale} />, ld: graph([crumbs]) }
    case 'security':
      return { node: <SecurityPage locale={locale} />, ld: graph([crumbs, faqLd(c.security.faq)]) }
    case 'support':
      return { node: <SupportPage locale={locale} />, ld: graph([crumbs, faqLd(c.support.groups.flatMap((g) => g.items))]) }
    case 'contact':
      return { node: <ContactPage locale={locale} />, ld: graph([crumbs, { '@type': 'ContactPage', name: c.contact.intro.h1 }]) }
    case 'about':
      return { node: <AboutPage locale={locale} />, ld: graph([crumbs, { '@type': 'AboutPage', name: c.about.intro.h1 }]) }
    case 'press':
      return { node: <PressPage locale={locale} />, ld: graph([crumbs]) }
    case 'ai':
      return { node: <AiPage locale={locale} />, ld: graph([crumbs]) }
    case 'guides':
      return child
        ? { node: <GuidePage locale={locale} slug={child} />, ld: graph([crumbs, articleLd(locale, child)]) }
        : { node: <GuidesIndex locale={locale} />, ld: graph([crumbs]) }
    case 'tools':
      if (!child) return { node: <ToolsHub locale={locale} />, ld: graph([crumbs]) }
      return child === 'daily-spending-number'
        ? { node: <DailyToolPage locale={locale} />, ld: graph([crumbs, toolLd(locale, slug)]) }
        : { node: <EmergencyToolPage locale={locale} />, ld: graph([crumbs, toolLd(locale, slug)]) }
    case 'delete-account':
      return { node: <DeleteAccountPage locale={locale} />, ld: graph([crumbs]) }
    case 'glossary':
      return { node: <GlossaryPage locale={locale} />, ld: graph([crumbs, glossaryLd(locale)]) }
    case 'compare':
      return { node: <ComparePage locale={locale} />, ld: graph([crumbs]) }
    case 'cookies':
      return { node: <CookiesPage locale={locale} />, ld: graph([crumbs]) }
    default:
      return null
  }
}
