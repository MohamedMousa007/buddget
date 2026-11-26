'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateVariant = 'default' | 'hero' | 'card'
type EmptyStateTone = 'brand' | 'positive' | 'neutral'

interface EmptyStateProps {
  /** Glyph drawn inside the unified 56px tile. */
  icon?: ReactNode
  /** Tile colour behind `icon`: brand for a first step, positive for "all clear", neutral for no results. */
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
  /**
   * The light-touch sizes, only with `variant="card"`: `page` for a screen's own empty state (56px tile, 17px title),
   * `section` for an empty block inside a populated screen (44px tile, 15px title). Unset keeps the original look.
   */
  size?: 'page' | 'section'
}

const TILE: Record<EmptyStateTone, string> = {
  brand: 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]',
  positive: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]',
  /** A quiet grey tile: nothing to fix, nothing to celebrate (no matching results). */
  neutral: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]',
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

/** Light-touch sizes (`ltEmpty` in the mockup): flat card, tile, title and body per size. */
const LT_SIZE = {
  page: {
    root: 'flex flex-col items-center rounded-3xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-6 py-8 text-center',
    tile: 'size-14 rounded-[18px] [&_svg]:size-7',
    title: 'mt-4 text-[1.0625rem] font-bold text-[var(--color-brand-text-primary)]',
  },
  section: {
    root: 'flex flex-col items-center rounded-3xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-6 py-6 text-center',
    tile: 'size-11 rounded-[14px] [&_svg]:size-5',
    title: 'mt-4 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]',
  },
} as const
const LT_DESCRIPTION = 'mt-1 max-w-[30ch] text-[0.84375rem] leading-snug text-[var(--color-brand-text-secondary)]'

export function EmptyState({ icon, iconTone = 'brand', illustration, title, description, action, children, className, variant = 'default', size }: EmptyStateProps) {
  const c = emptyStateClasses(variant)
  const lt = size ? LT_SIZE[size] : null
  return (
    <div className={cn(lt?.root ?? c.root, className)} role={children ? undefined : 'status'}>
      {illustration ??
        (icon != null ? (
          <span className={cn('flex items-center justify-center', lt?.tile ?? 'size-14 rounded-2xl [&_svg]:size-7', TILE[iconTone])} aria-hidden>
            {icon}
          </span>
        ) : null)}
      <p className={lt?.title ?? c.title}>{title}</p>
      {description ? <p className={lt ? LT_DESCRIPTION : c.description}>{description}</p> : null}
      {children ? <div className={c.body}>{children}</div> : null}
      {action ? <div className={c.action}>{action}</div> : null}
    </div>
  )
}
