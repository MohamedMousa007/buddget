'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** The portal's section surface: the app `Card` with a titled header row. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** No body padding — for tables that run edge to edge. */
  flush?: boolean
}) {
  return (
    <Card padding="none" elevation="sm" className={cn('min-w-0 overflow-hidden', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-brand-border)] px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(flush ? '' : 'p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--color-brand-text-primary)]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--color-brand-text-secondary)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function KeyValue({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-[var(--color-brand-text-muted)]">{label}</dt>
      <dd className={cn('min-w-0 truncate text-end text-[var(--color-brand-text-primary)]', mono && 'font-mono-numbers')}>{children}</dd>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'negative' | 'positive'; children: ReactNode }) {
  const styles = {
    info: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]',
    warning: 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]',
    negative: 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]',
    positive: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]',
  }
  return <div role={tone === 'negative' ? 'alert' : 'status'} className={cn('rounded-xl px-3.5 py-2.5 text-sm', styles[tone])}>{children}</div>
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--color-brand-elevated)]" />
      ))}
    </div>
  )
}
