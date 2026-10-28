'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BuddgetWordmark } from '@/components/brand'
import { WEB_APP_URL, type SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { ThemeToggle } from './ThemeToggle'

type Props = { locale: SiteLocale; slug: string }

const MEGA: { slug: string; color: string; icon: React.ReactNode }[] = [
  { slug: 'bank-text-tracking', color: '#1FC3B2', icon: <><path d="M4 5h16v11H9l-5 4V5z" /><path d="M8 9.5h8M8 12.5h5" /></> },
  { slug: 'budgets-and-daily-number', color: '#F0BE5B', icon: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v4M12 12l3 2" /></> },
  { slug: 'buddgy-assistant', color: '#8B5CF6', icon: <><path d="M3.5 12.5a8.5 8.5 0 0 1 17 0V16a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z" /><path d="M9.5 13v1.5M14.5 13v1.5" /></> },
  { slug: 'goals-and-savings', color: '#389BD9', icon: <path d="M5 21V4M5 5h12l-2.5 3.5L17 12H5" /> },
  { slug: 'debts-and-installments', color: '#E5684D', icon: <><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10.5h18M7 15h3" /></> },
  { slug: 'subscriptions', color: '#1FC3B2', icon: <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" /> },
]

/** Floating tabbed header. Tabs reach the real pages; the Features menu opens a panel of feature pages. */
export function SiteNav({ locale, slug }: Props) {
  const c = siteContent[locale]
  const n = c.nav
  const other: SiteLocale = locale === 'en' ? 'ar' : 'en'
  const [mega, setMega] = useState(false)
  const [sheet, setSheet] = useState(false)
  const megaRef = useRef<HTMLElement>(null)
  const home = pathFor(locale, '')

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (megaRef.current && !megaRef.current.contains(e.target as Node)) setMega(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMega(false); setSheet(false) } }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = sheet ? 'hidden' : ''
    return () => { document.documentElement.style.overflow = '' }
  }, [sheet])

  const links = [
    { label: n.how, href: `${home}#story`, cls: '' },
    { label: n.afford, href: `${home}#afford`, cls: '' },
    { label: n.pricing, href: pathFor(locale, 'pricing'), cls: 'opt', slug: 'pricing' },
    { label: n.security, href: pathFor(locale, 'security'), cls: 'opt', slug: 'security' },
    { label: n.help, href: pathFor(locale, 'support'), cls: 'opt', slug: 'support' },
  ]
  const mobile = [
    { label: n.features, href: pathFor(locale, 'features') },
    { label: n.how, href: `${home}#story` },
    { label: n.afford, href: `${home}#afford` },
    { label: n.pricing, href: pathFor(locale, 'pricing') },
    { label: n.security, href: pathFor(locale, 'security') },
    { label: n.help, href: pathFor(locale, 'support') },
  ]
  const feats = MEGA.map((m) => ({ ...m, item: c.features.items.find((f) => f.slug === m.slug) })).filter((m) => m.item)

  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <div className="nav-bar">
            <Link className="wm" href={home} aria-label="Buddget"><BuddgetWordmark height={24} /></Link>
            <nav className="tabs" aria-label="Main" ref={megaRef}>
              <button className="tab" type="button" aria-expanded={mega} aria-controls="hm-mega" onClick={(e) => { e.stopPropagation(); setMega((v) => !v) }}>
                <span>{n.features}</span>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4.5 6 8.5 10 4.5" /></svg>
              </button>
              {links.map((l) => (
                <Link key={l.href} className={`tab ${l.cls}`} href={l.href} aria-current={l.slug && (slug === l.slug || slug.startsWith(`${l.slug}/`)) ? 'page' : undefined}>{l.label}</Link>
              ))}
            </nav>
            <div className="nav-end">
              <a className="pill login" href={WEB_APP_URL} data-track="cta">{n.login}</a>
              <ThemeToggle toLight={n.themeToLight} toDark={n.themeToDark} />
              <Link className="lang" href={pathFor(other, slug)} hrefLang={other} lang={other} aria-label={n.switchTo}>{n.switchLabel}</Link>
              <Link className="pill pill-p nav-cta" href={pathFor(locale, 'download')} data-track="cta">{n.cta}</Link>
              <button className="burger" type="button" aria-label={n.menu} aria-expanded={sheet} aria-controls="hm-sheet" onClick={() => setSheet(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </button>
            </div>
          </div>
          <div className={`mega${mega ? ' open' : ''}`} id="hm-mega" role="region" aria-label={n.menuTitle} onClick={(e) => { if ((e.target as Element).closest('a')) setMega(false) }}>
            {feats.map((m) => (
              <Link key={m.slug} className="mi" href={pathFor(locale, `features/${m.slug}`)} tabIndex={mega ? 0 : -1}>
                <i style={{ background: `${m.color}26`, color: m.color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{m.icon}</svg></i>
                <span><b>{m.item!.name}</b><span>{m.item!.short}</span></span>
              </Link>
            ))}
            <div className="mega-foot">
              <Link href={`${home}#afford`} tabIndex={mega ? 0 : -1}>{n.megaAfford} {locale === 'ar' ? '←' : '→'}</Link>
              <Link href={pathFor(locale, 'tools')} tabIndex={mega ? 0 : -1}>{n.megaTools}</Link>
              <Link href={pathFor(locale, 'features')} tabIndex={mega ? 0 : -1}>{n.features}</Link>
            </div>
          </div>
        </div>
      </header>
      <div className={`sheet${sheet ? ' open' : ''}`} id="hm-sheet" role="dialog" aria-modal="true" aria-label={n.menu} aria-hidden={!sheet} onClick={(e) => { if ((e.target as Element).closest('a')) setSheet(false) }}>
        <button className="sheet-x" type="button" aria-label={n.close} onClick={() => setSheet(false)} tabIndex={sheet ? 0 : -1}>×</button>
        {mobile.map((l) => <Link key={l.href} className="sl" href={l.href} tabIndex={sheet ? 0 : -1}>{l.label}</Link>)}
        <div className="sh-cta">
          <Link className="pill pill-p pill-lg" href={pathFor(locale, 'download')} data-track="cta" tabIndex={sheet ? 0 : -1}>{n.cta}</Link>
          <a className="pill pill-g pill-lg" href={WEB_APP_URL} data-track="cta" tabIndex={sheet ? 0 : -1}>{c.common.tryBrowser}</a>
          <a className="pill pill-g pill-lg" href={WEB_APP_URL} data-track="cta" tabIndex={sheet ? 0 : -1}>{n.login}</a>
          <Link className="pill pill-g pill-lg" href={pathFor(other, slug)} hrefLang={other} lang={other} tabIndex={sheet ? 0 : -1}>{n.switchLabel}</Link>
          <ThemeToggle withLabel className="pill pill-g pill-lg theme-row" toLight={n.themeToLight} toDark={n.themeToDark} />
        </div>
      </div>
    </>
  )
}
