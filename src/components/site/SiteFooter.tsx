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
    <footer className="foot dark">
      <div className="wrap">
        <div className="foot-g g5">
          <div className="flex flex-col gap-4">
            <BuddgetWordmark height={26} />
            <p className="max-w-[28ch] text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>{f.tag}</p>
            <SocialLinks label={f.follow} />
          </div>
          {groups.map((g) => (
            <nav key={g.title} aria-label={g.title}>
              <h2>{g.title}</h2>
              <ul>
                {g.items.map((i) => (
                  <li key={i.href}><Link className="l" href={i.href}>{i.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="ghost" aria-hidden="true"><BuddgetWordmark mono height={120} title="" /></div>
        <div className="foot-b"><span>{f.copy}</span><span>{f.legalNote}</span></div>
      </div>
    </footer>
  )
}
