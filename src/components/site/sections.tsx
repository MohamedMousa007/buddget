import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STORE_LINKS, WEB_APP_URL, type SiteLocale } from '@/lib/site/config'
import { reviewsFor } from '@/lib/site/content/reviews'
import type { Faq } from '@/lib/site/content/types'
import { pathFor, siteContent } from '@/lib/site/routes'
import type { ScreenKey } from '@/lib/site/screens'
import { PhoneShot } from './PhoneShot'
import { ButtonLink, Container, Eyebrow, H1, H3, Lede, Section } from './ui'

export function Crumbs({ locale, trail }: { locale: SiteLocale; trail: { label: string; slug?: string }[] }) {
  const c = siteContent[locale].common
  return (
    <nav aria-label={c.breadcrumb} className="flex flex-wrap items-center gap-2 pt-5 text-sm text-brand-text-secondary">
      <Link href={pathFor(locale, '')} className="inline-flex min-h-11 items-center hover:text-brand-primary-ink">{c.home}</Link>
      {trail.map((t) => (
        <span key={t.label} className="flex items-center gap-2">
          <span aria-hidden>/</span>
          {t.slug !== undefined ? <Link href={pathFor(locale, t.slug)} className="inline-flex min-h-11 items-center hover:text-brand-primary-ink">{t.label}</Link> : <span aria-current="page" className="text-brand-text-primary">{t.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function PageHero({ locale, trail, eyebrow, h1, lede, children }: { locale: SiteLocale; trail?: { label: string; slug?: string }[]; eyebrow?: string; h1: string; lede?: string; children?: ReactNode }) {
  return (
    <Section pad="sm" className="border-b border-brand-border">
      <Container>
        {trail ? <Crumbs locale={locale} trail={trail} /> : null}
        <div className="flex max-w-3xl flex-col gap-5 pb-8 pt-8 sm:pb-12">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <H1 className="sm:text-5xl">{h1}</H1>
          {lede ? <Lede>{lede}</Lede> : null}
          {children}
        </div>
      </Container>
    </Section>
  )
}

export function FaqList({ items, className }: { items: Faq[]; className?: string }) {
  return (
    <div className={cn('border-t border-brand-border', className)}>
      {items.map((f, i) => (
        <details key={f.q} open={i === 0} className="group border-b border-brand-border py-1">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            {f.q}
            <span aria-hidden className="font-mono text-2xl text-brand-primary-ink group-open:hidden">+</span>
            <span aria-hidden className="hidden font-mono text-2xl text-brand-primary-ink group-open:inline">{'−'}</span>
          </summary>
          <p className="max-w-[68ch] pb-5 text-brand-text-secondary">{f.a}</p>
        </details>
      ))}
    </div>
  )
}

const APPLE = 'M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.100 2.800-2.200c.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.900zM14.200 5.700c.6-.8 1.100-1.800.9-2.900-.9 0-2 .6-2.700 1.400-.6.700-1.100 1.800-1 2.800 1 .1 2.100-.5 2.800-1.300z'
const PLAY = 'M4 3.500v17c0 .5.600.8 1 .5l14-8.500c.4-.3.4-.8 0-1L5 3c-.4-.3-1 0-1 .5z'

/** Store buttons. Inert and dashed until the listing URL is set in `STORE_LINKS`, then real links. */
export function StoreBadges({ locale }: { locale: SiteLocale; dark?: boolean }) {
  const d = siteContent[locale].download
  const items = [
    { href: STORE_LINKS.appStore, name: 'App Store', note: d.soonApple, glyph: APPLE },
    { href: STORE_LINKS.googlePlay, name: 'Google Play', note: d.soonGoogle, glyph: PLAY },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((s) => {
        const inner = (
          <>
            <svg aria-hidden viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d={s.glyph} /></svg>
            <span className="flex flex-col text-start">
              <small className="text-[11px] leading-tight opacity-80">{s.href ? d.storeGet : d.badge}</small>
              <strong className="text-lg leading-tight">{s.name}</strong>
            </span>
          </>
        )
        return s.href ? (
          <a key={s.name} href={s.href} className="inline-flex min-h-14 items-center gap-3 rounded-xl border border-brand-border-strong bg-brand-text-primary px-5 text-brand-bg">{inner}</a>
        ) : (
          <span key={s.name} role="img" aria-label={s.note} className="inline-flex min-h-14 items-center gap-3 rounded-xl border border-dashed border-brand-border-strong px-5 text-brand-text-primary">{inner}</span>
        )
      })}
    </div>
  )
}

export function Split({ children, visual, reverse, className }: { children: ReactNode; visual: ReactNode; reverse?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-12 lg:gap-20', reverse ? 'lg:flex-row-reverse' : 'lg:flex-row', className)}>
      <div className="flex min-w-0 flex-col gap-5 lg:flex-1 lg:basis-[440px]">{children}</div>
      <div className="relative flex justify-center lg:flex-none lg:basis-[420px]">{visual}</div>
    </div>
  )
}

export function Reviews({ locale }: { locale: SiteLocale }) {
  const r = siteContent[locale].home.reviews
  const { reviews, isSample } = reviewsFor(locale)
  if (reviews.length === 0) return null
  return (
    <Section id="reviews" pad="lg">
      <Container>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-10">
          <div className="flex max-w-2xl flex-col gap-4">
            {isSample ? <span className="inline-flex self-start rounded-lg bg-brand-amber-soft px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-brand-amber">{r.sample}</span> : null}
            <h2 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{r.h2}</h2>
            <Lede>{r.sub}</Lede>
          </div>
        </div>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((v) => (
            <li key={v.name}>
              <figure className="m-0 flex h-full flex-col gap-4 rounded-3xl border border-brand-border bg-brand-card p-7">
                <blockquote className="m-0 text-lg leading-relaxed">{v.quote}</blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <span aria-hidden className="grid size-10 flex-none place-items-center rounded-full bg-brand-primary-soft font-semibold text-brand-primary-ink">{v.initial}</span>
                  <span className="text-sm leading-snug text-brand-text-secondary"><b className="block text-[15px] text-brand-text-primary">{v.name}</b>{v.meta}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}

export function BottomCta({ locale, title, text }: { locale: SiteLocale; title: string; text?: string }) {
  const c = siteContent[locale].common
  return (
    <Section pad="md">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-brand-primary-soft p-8 sm:p-10">
          <div><H3 className="text-2xl">{title}</H3>{text ? <p className="mt-1 text-brand-text-secondary">{text}</p> : null}</div>
          <div className="flex flex-wrap gap-3"><ButtonLink href={pathFor(locale, 'download')} size="lg">{c.getApp}</ButtonLink><ButtonLink href={WEB_APP_URL} variant="outline" size="lg" external>{c.tryBrowser}</ButtonLink></div>
        </div>
      </Container>
    </Section>
  )
}
