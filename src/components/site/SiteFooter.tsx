import Link from 'next/link'
import { BuddgetWordmark } from '@/components/brand'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { SocialLinks } from './SocialLinks'

export function SiteFooter({ locale }: { locale: SiteLocale }) {
  const f = siteContent[locale].footer
  const l = f.links
  const groups: { title: string; items: { label: string; href: string }[] }[] = [
    {
      title: f.product,
      items: [
        { label: l.features, href: pathFor(locale, 'features') },
        { label: l.how, href: pathFor(locale, 'how-it-works') },
        { label: l.pricing, href: pathFor(locale, 'pricing') },
        { label: l.download, href: pathFor(locale, 'download') },
        { label: l.tools, href: pathFor(locale, 'tools') },
      ],
    },
    {
      title: f.learn,
      items: [
        { label: l.guides, href: pathFor(locale, 'guides') },
        { label: l.support, href: pathFor(locale, 'support') },
        { label: l.security, href: pathFor(locale, 'security') },
        { label: l.glossary, href: pathFor(locale, 'glossary') },
        { label: l.ai, href: pathFor(locale, 'ai') },
      ],
    },
    {
      title: f.company,
      items: [
        { label: l.about, href: pathFor(locale, 'about') },
        { label: l.contact, href: pathFor(locale, 'contact') },
        { label: l.press, href: pathFor(locale, 'press') },
        { label: l.compare, href: pathFor(locale, 'compare/spreadsheet') },
      ],
    },
    {
      title: f.legal,
      items: [
        { label: l.privacy, href: '/legal/privacy' },
        { label: l.terms, href: '/legal/terms' },
        { label: l.cookies, href: pathFor(locale, 'cookies') },
        { label: l.delete, href: pathFor(locale, 'delete-account') },
      ],
    },
  ]
  return (
    <footer className="border-t border-brand-border bg-brand-bg text-brand-text-primary">
      <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8">
        <div className="flex flex-wrap gap-12">
          <div className="flex min-w-[240px] flex-1 basis-64 flex-col gap-4">
            <BuddgetWordmark height={26} />
            <p className="max-w-[32ch] text-sm leading-relaxed text-brand-text-secondary">{f.tag}</p>
            <SocialLinks label={f.follow} />
          </div>
          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title} className="min-w-[140px] flex-1 basis-36">
              <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.1em] text-brand-text-secondary rtl:font-sans rtl:text-sm rtl:normal-case rtl:tracking-normal">{g.title}</h2>
              <ul>
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} className="flex min-h-11 items-center text-[15px] hover:text-brand-primary-ink">{i.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <hr className="my-9 border-brand-border" />
        <div className="flex flex-wrap justify-between gap-3 text-sm text-brand-text-secondary">
          <span>{f.copy}</span>
          <span>{f.legalNote}</span>
        </div>
      </div>
    </footer>
  )
}
