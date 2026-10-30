'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateVariant = 'default' | 'hero' | 'card'
type EmptyStateTone = 'brand' | 'positive'

interface EmptyStateProps {
  /** Glyph drawn inside the unified 56px tile. */
  icon?: ReactNode
  /** Tile colour behind `icon`: brand for a first step, positive for "all clear". */
  iconTone?: EmptyStateTone
  /** Replaces `icon` with a ready-made visual (mascot) rendered as given, above the title. */
  illustration?: ReactNode
  title: string
  description?: string
  /** Primary action row; several buttons stack and centre. */
  action?: ReactNode
  /** Body between the description and the action: tiles, rows, a checklist, a form. Full width, start aligned. */
  children?: ReactNode
  className?: string
  /**
   * `default` pads itself for a lone block, `hero` leaves spacing to the caller's wrapper,
   * `card` is `hero` on the brand card surface for page-level first-run states.
   */
  variant?: EmptyStateVariant
}

const TILE: Record<EmptyStateTone, string> = {
  brand: 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]',
  positive: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]',
}

export function emptyStateClasses(variant: EmptyStateVariant) {
  const shared = {
    title: 'mt-4 text-lg font-bold text-[var(--color-brand-text-primary)]',
    description: 'mt-1 max-w-md text-sm text-[var(--color-brand-text-secondary)]',
    body: 'mt-5 w-full text-start',
    action: 'mt-5 flex w-full flex-col items-center gap-2.5',
  }
  const root: Record<EmptyStateVariant, string> = {
    default: 'flex flex-col items-center justify-center px-4 py-8 text-center sm:py-12',
    hero: 'flex flex-col items-center text-center',
    card: 'flex flex-col items-center rounded-3xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5 text-center shadow-sm lg:px-8 lg:py-8',
  }
  return { root: root[variant], ...shared }
}

export function EmptyState({ icon, iconTone = 'brand', illustration, title, description, action, children, className, variant = 'default' }: EmptyStateProps) {
  const c = emptyStateClasses(variant)
  return (
    <div className={cn(c.root, className)} role={children ? undefined : 'status'}>
      {illustration ??
        (icon != null ? (
          <span className={cn('flex size-14 items-center justify-center rounded-2xl [&_svg]:size-7', TILE[iconTone])} aria-hidden>
            {icon}
          </span>
        ) : null)}
      <p className={c.title}>{title}</p>
      {description ? <p className={c.description}>{description}</p> : null}
      {children ? <div className={c.body}>{children}</div> : null}
      {action ? <div className={c.action}>{action}</div> : null}
    </div>
  )
}
