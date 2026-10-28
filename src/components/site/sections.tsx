import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STORE_LINKS, type SiteLocale } from '@/lib/site/config'
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

export function StoreBadges({ locale, dark }: { locale: SiteLocale; dark?: boolean }) {
  const d = siteContent[locale].download
  const items = [
    { href: STORE_LINKS.appStore, name: 'App Store', note: d.soonApple },
    { href: STORE_LINKS.googlePlay, name: 'Google Play', note: d.soonGoogle },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((s) =>
        s.href ? (
          <a key={s.name} href={s.href} className="inline-flex min-h-14 items-center rounded-xl border border-brand-border-strong bg-brand-text-primary px-5 text-brand-bg">
            <strong className="text-lg">{s.name}</strong>
          </a>
        ) : (
          <span key={s.name} aria-label={s.note} className={cn('inline-flex min-h-14 flex-col justify-center rounded-xl border border-dashed px-5', dark ? 'border-brand-border-strong text-brand-text-primary' : 'border-brand-border-strong text-brand-text-primary')}>
            <small className="text-[11px] leading-tight text-brand-text-secondary">{d.badge}</small>
            <strong className="text-lg leading-tight">{s.name}</strong>
          </span>
        ),
      )}
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

export function Gallery({ items, locale }: { items: { screen: ScreenKey; title: string; cap: string }[]; locale: SiteLocale }) {
  return (
    <div tabIndex={0} aria-label={siteContent[locale].home.gallery.h2} className="site-gallery -mx-5 flex gap-7 overflow-x-auto px-5 pb-6 sm:-mx-8 sm:px-8">
      {items.map((g) => (
        <figure key={g.screen} className="m-0 flex w-[232px] flex-none flex-col gap-3">
          <PhoneShot screen={g.screen} locale={locale} size="sm" />
          <figcaption className="grid gap-0.5">
            <b className="text-[17px]">{g.title}</b>
            <span className="text-sm text-brand-text-secondary">{g.cap}</span>
          </figcaption>
        </figure>
      ))}
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
          <ButtonLink href={pathFor(locale, 'download')} size="lg">{c.getApp}</ButtonLink>
        </div>
      </Container>
    </Section>
  )
}
