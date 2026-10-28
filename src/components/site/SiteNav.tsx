'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { BuddgetWordmark } from '@/components/brand'
import { IconButton } from '@/components/ui/IconButton'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { cn } from '@/lib/utils'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor } from '@/lib/site/routes'
import { siteContent } from '@/lib/site/routes'

type Props = { locale: SiteLocale; slug: string; dark?: boolean }

export function SiteNav({ locale, slug, dark }: Props) {
  const c = siteContent[locale].nav
  const [open, setOpen] = useState(false)
  const other: SiteLocale = locale === 'en' ? 'ar' : 'en'
  const links = [
    { label: c.features, slug: 'features' },
    { label: c.how, slug: 'how-it-works' },
    { label: c.pricing, slug: 'pricing' },
    { label: c.security, slug: 'security' },
    { label: c.help, slug: 'support' },
  ]
  return (
    <header className={cn(dark && 'dark', 'sticky top-0 z-40 border-b border-brand-border/60 bg-brand-bg/80 text-brand-text-primary backdrop-blur-xl')}>
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <Link href={pathFor(locale, '')} aria-label="Buddget" className="flex min-h-11 items-center">
          <BuddgetWordmark height={26} />
        </Link>
        <nav aria-label="Main" className="ms-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.slug}
              href={pathFor(locale, l.slug)}
              aria-current={slug === l.slug || slug.startsWith(`${l.slug}/`) ? 'page' : undefined}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium text-brand-text-secondary hover:text-brand-text-primary aria-[current=page]:text-brand-text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <Link href={pathFor(other, slug)} hrefLang={other} lang={other} aria-label={c.switchTo} className="hidden min-h-11 items-center px-2 text-sm font-medium text-brand-text-secondary hover:text-brand-text-primary sm:inline-flex">
          {c.switchLabel}
        </Link>
        <Link href={pathFor(locale, 'download')} className={cn(buttonVariants({ variant: 'default', size: 'touch' }), 'hidden rounded-full px-6 font-semibold sm:inline-flex')}>
          {c.cta}
        </Link>
        <IconButton variant="outlined" size="md" className="lg:hidden" aria-expanded={open} aria-controls="site-menu" aria-label={open ? c.close : c.menu} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </IconButton>
      </div>
      {open ? (
        <div id="site-menu" className="border-t border-brand-border bg-brand-bg px-5 pb-6 pt-2 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((l) => (
              <Link key={l.slug} href={pathFor(locale, l.slug)} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-brand-border text-lg font-medium">
                {l.label}
              </Link>
            ))}
            <Link href={pathFor(other, slug)} hrefLang={other} lang={other} className="flex min-h-12 items-center text-lg font-medium text-brand-text-secondary">{c.switchLabel}</Link>
          </nav>
          <Link href={pathFor(locale, 'download')} onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: 'default', size: 'cta-block' }), 'mt-3 rounded-full text-base font-semibold')}>
            {c.cta}
          </Link>
        </div>
      ) : null}
    </header>
  )
}
