'use client'

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  /** Replaces `icon` with a ready-made visual (tile, mascot) rendered as given, above the title. */
  illustration?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** `hero` is the larger, bolder title for a lone empty card; spacing comes from the caller's wrapper. */
  variant?: 'default' | 'hero'
}

export function emptyStateClasses(variant: 'default' | 'hero') {
  return variant === 'hero'
    ? {
        root: 'flex flex-col items-center text-center',
        title: 'mt-4 text-lg font-bold text-[var(--color-brand-text-primary)]',
        description: 'mt-1 max-w-md text-sm text-[var(--color-brand-text-muted)]',
        action: 'mt-5',
      }
    : {
        root: 'flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4',
        title: 'text-base font-medium text-[var(--color-brand-text-primary)] mb-1',
        description: 'text-sm text-[var(--color-brand-text-muted)] max-w-sm mb-4',
        action: '',
      }
}

export function EmptyState({ icon, illustration, title, description, action, className = '', variant = 'default' }: EmptyStateProps) {
  const c = emptyStateClasses(variant)
  return (
    <div className={`${c.root} ${className}`} role="status">
      {illustration ?? (icon != null ? <div className="text-3xl mb-3" aria-hidden>{icon}</div> : null)}
      <p className={c.title}>{title}</p>
      {description ? <p className={c.description}>{description}</p> : null}
      {action && c.action ? <div className={c.action}>{action}</div> : action}
    </div>
  )
}
