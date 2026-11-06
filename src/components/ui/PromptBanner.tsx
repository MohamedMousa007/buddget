'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'

interface InlinePromptBannerProps {
  variant?: 'inline'
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

/** One CTA in the overlay card. Labels stay ≤ 16 characters so the row never wraps. */
export interface PromptBannerAction {
  label: string
  variant: 'default' | 'success' | 'secondary'
  onPress: () => void
}

/**
 * The drop-down card of the prompt stack (`BannerStack`): card surface, 20px radius,
 * shadow-lg, a tone icon chip, ✕ = snooze, an equal-column CTA row (max two), pager
 * dots with "1 of N", and a grabber. Gestures live in the stack, not here.
 */
interface OverlayPromptBannerProps {
  variant: 'overlay'
  title: ReactNode
  description?: ReactNode
  /** 18px glyph; the chip around it is drawn here. */
  icon: ReactNode
  tone?: 'brand' | 'positive' | 'warning'
  actions: PromptBannerAction[]
  onSnooze: () => void
  snoozeLabel: string
  /** 0-based position in the stack and its size — pager hidden for a single card. */
  index: number
  count: number
  counterLabel: string
  className?: string
}

export type PromptBannerProps = InlinePromptBannerProps | OverlayPromptBannerProps

const OVERLAY_CHIP = {
  brand: 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]',
  positive: 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]',
  warning: 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]',
} as const

function OverlayPromptBanner({
  title,
  description,
  icon,
  tone = 'brand',
  actions,
  onSnooze,
  snoozeLabel,
  index,
  count,
  counterLabel,
  className,
}: OverlayPromptBannerProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] pb-2.5 pe-1.5 ps-3.5 pt-3 shadow-[var(--shadow-lg)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]', OVERLAY_CHIP[tone])}>
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
          <span className="text-sm font-bold leading-[1.3] text-[var(--color-brand-text-primary)] [overflow-wrap:anywhere] [text-wrap:pretty]">{title}</span>
          {description ? (
            <span className="text-[0.78125rem] leading-[1.4] text-[var(--color-brand-text-secondary)]">{description}</span>
          ) : null}
        </span>
        <span className="-mt-1.5">
          <IconButton variant="ghost" size="sm" aria-label={snoozeLabel} onClick={onSnooze}>
            <X className="size-4" strokeWidth={2} />
          </IconButton>
        </span>
      </div>
      <div
        className="mt-2.5 grid gap-2 pe-2"
        style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
      >
        {actions.map((a) => (
          <Button key={a.label} variant={a.variant} size="touch" className="w-full" onClick={a.onPress}>
            {a.label}
          </Button>
        ))}
      </div>
      {count > 1 ? (
        <div className="mt-1 flex items-center justify-center gap-[5px]" aria-hidden>
          {Array.from({ length: count }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-[5px] rounded-full',
                i === index ? 'w-3.5 bg-[var(--color-brand-primary)]' : 'w-[5px] bg-[var(--color-brand-border-strong)]',
              )}
            />
          ))}
          <span className="ms-1.5 font-mono-numbers text-[0.6875rem] text-[var(--color-brand-text-muted)]">{counterLabel}</span>
        </div>
      ) : null}
      <div className="mx-auto mt-1.5 h-1 w-9 rounded-full bg-[var(--color-brand-border-strong)]" aria-hidden />
    </div>
  )
}

const TONE = {
  brand: {
    surface: 'border-transparent bg-[var(--color-brand-primary-soft)]',
    icon: 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]',
    title: 'text-[var(--color-brand-text-primary)]',
  },
  warning: {
    surface: 'border-transparent bg-[var(--color-brand-amber-soft)]',
    icon: 'bg-[var(--color-brand-amber)] text-[var(--color-brand-on-amber)]',
    title: 'text-[var(--color-brand-text-primary)]',
  },
  negative: {
    surface: 'border-transparent bg-[var(--color-brand-red-soft)]',
    icon: 'bg-[var(--color-brand-red)] text-[var(--color-brand-on-red)]',
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
export function PromptBanner(props: PromptBannerProps) {
  return props.variant === 'overlay' ? <OverlayPromptBanner {...props} /> : <InlinePromptBanner {...props} />
}

function InlinePromptBanner({
  title,
  description,
  icon,
  confirmLabel,
  onConfirm,
  dismissLabel,
  onDismiss,
  tone = 'brand',
  className,
}: InlinePromptBannerProps) {
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
          <p className={cn('text-[0.84375rem] font-semibold leading-snug', t.title)}>{title}</p>
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
