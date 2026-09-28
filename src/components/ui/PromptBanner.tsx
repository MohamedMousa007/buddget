'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PromptBannerProps {
  /** One line, specific. "1,240 SAR arrived — is this your Al Rajhi salary?" */
  title: ReactNode
  /** Optional supporting line. Keep it to one sentence. */
  description?: ReactNode
  icon?: ReactNode
  /** The action that resolves the prompt. */
  confirmLabel: string
  onConfirm: () => void
  /**
   * The answer that also resolves it. REQUIRED when the prompt can recur:
   * a dismiss that silently returns next month is worse than no banner, so the
   * caller must persist this decision, not just hide the component.
   */
  dismissLabel?: string
  onDismiss?: () => void
  tone?: 'brand' | 'warning' | 'negative'
  className?: string
}

const TONE = {
  brand: {
    surface: 'border-transparent bg-[var(--color-brand-primary-soft)]',
    icon: 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]',
    title: 'text-[var(--color-brand-text-primary)]',
  },
  warning: {
    surface: 'border-transparent bg-[var(--color-brand-amber-soft)]',
    icon: 'bg-[var(--color-brand-amber)] text-white',
    title: 'text-[var(--color-brand-text-primary)]',
  },
  negative: {
    surface: 'border-transparent bg-[var(--color-brand-red-soft)]',
    icon: 'bg-[var(--color-brand-red)] text-white',
    title: 'text-[var(--color-brand-text-primary)]',
  },
} as const

/**
 * A conditional, self-resolving prompt.
 *
 * The rule this component exists to enforce: **it is present only when there is
 * something to resolve, and gone the instant there is nothing.** That is what
 * keeps a banner from reading as clutter — a permanent scoreboard nags, a banner
 * that disappears at zero does not.
 *
 * Render it conditionally; it has no "empty" state by design.
 *
 * Used for: an unmatched credit that probably belongs to a payday, an overdue
 * payday (where the income total is silently over-reporting), and SMS review
 * prompts.
 */
export function PromptBanner({
  title,
  description,
  icon,
  confirmLabel,
  onConfirm,
  dismissLabel,
  onDismiss,
  tone = 'brand',
  className,
}: PromptBannerProps) {
  const t = TONE[tone]
  return (
    <Card padding="md" radius="default" className={cn(t.surface, className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', t.icon)}>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className={cn('text-[13.5px] font-semibold leading-snug', t.title)}>{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-snug text-[var(--color-brand-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="touch" onClick={onConfirm} className="flex-1">
          {confirmLabel}
        </Button>
        {dismissLabel && onDismiss ? (
          <Button size="touch" variant="ghost" onClick={onDismiss} className="flex-1">
            {dismissLabel}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
