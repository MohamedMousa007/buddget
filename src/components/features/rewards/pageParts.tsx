import { Fragment, type ReactNode } from 'react'
import { intlTag } from '@/lib/i18n/dateFormat'
import { cn } from '@/lib/utils'

/** Sets a value in bold inside a translated sentence: `withBold('Renews {b}', '17 Nov')`. A sentence with no `{b}` is returned as is. */
export function withBold(text: string, bold: ReactNode): ReactNode {
  const [before, after] = text.split('{b}')
  if (after === undefined) return text
  return <Fragment>{before}<b dir="auto">{bold}</b>{after}</Fragment>
}

/** The membership pages' section heading (the mockup's 17px `h3.sec`). */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 dir="auto" className={cn('m-0 text-[1.0625rem] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)] rtl:tracking-normal', className)}>{children}</h3>
}

/** A heading with the block under it, 10px apart. */
export function Section({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-2.5', className)}>
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      {children}
    </section>
  )
}

/** Centred fine print under a block. */
export function Fine({ children, className }: { children: ReactNode; className?: string }) {
  return <p dir="auto" className={cn('m-0 text-center text-[0.71875rem] leading-[1.45] text-[var(--color-brand-text-muted)]', className)}>{children}</p>
}

/** Secondary body line. */
export function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <p dir="auto" className={cn('m-0 text-[0.84375rem] leading-[1.45] text-[var(--color-brand-text-secondary)]', className)}>{children}</p>
}

/** The pages stack their blocks 22px apart, as the mockup's scroll column does. */
export function PageStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-[22px]', className)}>{children}</div>
}

/** Date as the cards print it: "17 NOV 2026". */
export function cardDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
}

/** Two-letter initials for an avatar. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? '').slice(0, 2)
  return letters.toUpperCase()
}

/** A date in a sentence, day first: "17 Nov 2026" (Arabic in its own form, Latin digits as the app sets them). */
export function plainDate(iso: string | null | undefined, locale: string, year = true): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale === 'ar' ? intlTag(locale) : 'en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
}
