import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/buttonVariants'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor } from '@/lib/site/routes'

export function Container({ children, narrow, className }: { children: ReactNode; narrow?: boolean; className?: string }) {
  return <div className={cn('mx-auto w-full px-5 sm:px-8', narrow ? 'max-w-3xl' : 'max-w-[1200px]', className)}>{children}</div>
}

type SectionProps = { children: ReactNode; id?: string; dark?: boolean; tone?: 'bg' | 'card'; className?: string; pad?: 'md' | 'lg' | 'sm' }

/** `dark` re-points the brand tokens to their dark values for the section, so children need no dark variants. */
export function Section({ children, id, dark, tone = 'bg', className, pad = 'md' }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        dark && 'dark',
        tone === 'bg' ? 'bg-brand-bg' : 'bg-brand-card',
        'text-brand-text-primary',
        pad === 'lg' ? 'py-20 sm:py-28' : pad === 'md' ? 'py-14 sm:py-20' : 'py-10 sm:py-14',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-brand-primary-ink rtl:font-sans rtl:text-sm rtl:normal-case rtl:tracking-normal">{children}</p>
}

export function H1({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('font-heading text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl rtl:leading-tight rtl:tracking-normal', className)}>{children}</h1>
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-heading text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl rtl:tracking-normal', className)}>{children}</h2>
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('font-heading text-xl font-semibold leading-snug', className)}>{children}</h3>
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('max-w-[56ch] text-lg leading-relaxed text-brand-text-secondary sm:text-xl', className)}>{children}</p>
}

export function SectionHead({ eyebrow, title, lede, center }: { eyebrow?: string; title: string; lede?: string; center?: boolean }) {
  return (
    <div className={cn('flex max-w-3xl flex-col gap-4', center && 'mx-auto items-center text-center')}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <H2>{title}</H2>
      {lede ? <Lede>{lede}</Lede> : null}
    </div>
  )
}

type ButtonLinkProps = {
  href: string
  children: ReactNode
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'md' | 'lg'
  className?: string
  external?: boolean
}

/** Anchor styled with the app's Button variants, pill-shaped for marketing surfaces. */
export function ButtonLink({ href, children, variant = 'default', size = 'md', className, external }: ButtonLinkProps) {
  const cls = cn(buttonVariants({ variant, size: 'cta' }), 'rounded-full px-7 text-base font-semibold', size === 'lg' && 'h-14 px-9', className)
  return external ? (
    <a href={href} className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  )
}

export function TextLink({ locale, slug, children }: { locale: SiteLocale; slug: string; children: ReactNode }) {
  return (
    <Link href={pathFor(locale, slug)} className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-primary-ink hover:underline">
      {children}
      <span aria-hidden className="rtl:rotate-180">→</span>
    </Link>
  )
}

export function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-base leading-relaxed sm:text-[17px]">
          <span aria-hidden className="mt-1 grid size-5 flex-none place-items-center rounded-full bg-brand-primary-soft text-brand-primary-ink">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5l4 4 8-9" /></svg>
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-brand-border bg-brand-card p-6 shadow-[var(--shadow-sm)] sm:p-7', className)}>{children}</div>
}
