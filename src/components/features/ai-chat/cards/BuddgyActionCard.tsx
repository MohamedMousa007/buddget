'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONE = {
  add: { head: 'bg-[var(--color-brand-primary-soft)]', ink: 'text-[var(--color-brand-primary-ink)]' },
  change: { head: 'bg-[var(--color-brand-elevated)]', ink: 'text-[var(--color-brand-text-secondary)]' },
  danger: { head: 'bg-[var(--color-brand-red-soft)]', ink: 'text-[var(--color-brand-red)]' },
} as const

export interface CardAction {
  label: string
  onClick: () => void
}

export interface BuddgyActionCardProps {
  tone: keyof typeof TONE
  icon: LucideIcon
  title: string
  /** Right of the title, e.g. a batch total. */
  meta?: string
  children: ReactNode
  /** The one main action. A Go card has none: its link chip is the action. */
  primary?: CardAction & { danger?: boolean; disabled?: boolean }
  secondary?: CardAction[]
  note?: string
}

/** The one shell every Buddgy proposal renders in: a tinted head, a body, one primary action and quiet secondaries. */
export function BuddgyActionCard({ tone, icon: Icon, title, meta, children, primary, secondary = [], note }: BuddgyActionCardProps) {
  const t = TONE[tone]
  return (
    <section aria-label={title} className="overflow-hidden rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-sm leading-normal text-[var(--color-brand-text-primary)]">
      <header className={cn('flex min-h-[52px] items-center gap-2.5 px-3.5 py-2', t.head)}>
        <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-card)]', t.ink)}>
          <Icon className="size-[18px]" />
        </span>
        <span dir="auto" className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{title}</span>
        {meta ? <span className="font-mono-numbers shrink-0 text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">{meta}</span> : null}
      </header>
      <div className="flex flex-col gap-3.5 p-3.5">
        {children}
        {primary || secondary.length > 0 || note ? (
          <div className="flex flex-col gap-1">
            {primary ? (
              <Button variant={primary.danger ? 'destructive-solid' : 'default'} size="cta-block" disabled={primary.disabled} onClick={primary.onClick}>
                {primary.label}
              </Button>
            ) : null}
            {secondary.length > 0 ? (
              <div className="flex justify-center gap-1">
                {secondary.map((s) => (
                  <Button key={s.label} variant="ghost" size="touch" onClick={s.onClick}>
                    {s.label}
                  </Button>
                ))}
              </div>
            ) : null}
            {note ? <span className="text-center text-xs text-[var(--color-brand-text-muted)]">{note}</span> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
