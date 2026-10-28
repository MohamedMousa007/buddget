import type { Metadata } from 'next'
import { SITE_URL, SOCIAL_LINKS, STORE_LINKS, SUPPORT_EMAIL, SITE_LOCALES, type SiteLocale } from './config'
import { findRoute, pathFor, siteContent, urlFor } from './routes'

const OG_LOCALE: Record<SiteLocale, string> = { en: 'en_US', ar: 'ar_EG' }
const ogImage = (locale: SiteLocale) => ({ url: `/og-${locale}.png`, width: 1200, height: 630, alt: siteContent[locale].meta.homeTitle })

export function buildMetadata(locale: SiteLocale, slug: string): Metadata {
  const route = findRoute(locale, slug)
  if (!route) return {}
  const languages: Record<string, string> = {}
  for (const l of SITE_LOCALES) languages[l === 'ar' ? 'ar-EG' : 'en'] = pathFor(l, slug)
  languages['x-default'] = pathFor('ar', slug)
  const isHome = slug === ''
  return {
    title: isHome ? { absolute: route.title } : route.title,
    description: route.description,
    alternates: { canonical: pathFor(locale, slug), languages },
    openGraph: {
      type: slug.startsWith('guides/') ? 'article' : 'website',
      siteName: 'Buddget',
      locale: OG_LOCALE[locale],
      alternateLocale: OG_LOCALE[locale === 'en' ? 'ar' : 'en'],
      url: urlFor(locale, slug),
      title: route.title,
      description: route.description,
      images: [ogImage(locale)],
    },
    twitter: { card: 'summary_large_image', title: route.title, description: route.description, images: [ogImage(locale).url] },
  }
}

const sameAs = () => SOCIAL_LINKS.filter((s) => s.url).map((s) => s.url)

function organization() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Buddget',
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    email: SUPPORT_EMAIL,
    ...(sameAs().length ? { sameAs: sameAs() } : {}),
  }
}

function application(locale: SiteLocale) {
  const c = siteContent[locale]
  const installUrl = STORE_LINKS.googlePlay ?? STORE_LINKS.appStore
  return {
    '@type': 'MobileApplication',
    '@id': `${SITE_URL}/#app`,
    name: 'Buddget',
    description: c.meta.homeDescription,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'iOS, Android',
    inLanguage: ['ar', 'en'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EGP' },
    publisher: { '@id': `${SITE_URL}/#organization` },
    ...(installUrl ? { installUrl } : {}),
  }
}

export function breadcrumbLd(locale: SiteLocale, slug: string, labels: string[]) {
  const c = siteContent[locale]
  const parts = slug.split('/')
  const items = [{ name: c.common.home, url: urlFor(locale, '') }]
  parts.forEach((_, i) => {
    const sub = parts.slice(0, i + 1).join('/')
    items.push({ name: labels[i] ?? sub, url: urlFor(locale, sub) })
  })
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  }
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

export function homeLd(locale: SiteLocale) {
  const c = siteContent[locale]
  return [
    organization(),
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Buddget', inLanguage: locale, publisher: { '@id': `${SITE_URL}/#organization` } },
    application(locale),
    faqLd(c.home.faq.items),
  ]
}

export function howToLd(locale: SiteLocale) {
  const c = siteContent[locale]
  return { '@type': 'HowTo', name: c.how.intro.h1, step: c.how.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h, text: s.p })) }
}

export function articleLd(locale: SiteLocale, slug: string) {
  const g = siteContent[locale].guides.items.find((x) => x.slug === slug)
  if (!g) return null
  return {
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    datePublished: g.published,
    dateModified: g.published,
    inLanguage: locale,
    mainEntityOfPage: urlFor(locale, `guides/${slug}`),
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }
}

export function glossaryLd(locale: SiteLocale) {
  const c = siteContent[locale]
  return { '@type': 'DefinedTermSet', name: c.glossary.intro.h1, hasDefinedTerm: c.glossary.terms.map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.def })) }
}

export function toolLd(locale: SiteLocale, slug: string) {
  const r = findRoute(locale, slug)
  if (!r) return null
  return { '@type': 'WebApplication', name: r.title, description: r.description, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'EGP' }, inLanguage: locale }
}

export function graph(nodes: (object | null)[]) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) }
}
