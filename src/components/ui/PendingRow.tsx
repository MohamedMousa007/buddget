'use client'

import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { cn } from '@/lib/utils'

/**
 * The one quiet row for something that needs the user, on the page where it changes a number and in the Inbox. It is
 * a button that opens what resolves it; it never dismisses and never stacks over content. Amber = a balance is off
 * until it is answered, teal = a review.
 */
export function PendingRow({
  tone,
  icon: Icon,
  title,
  subtitle,
  label,
  onPress,
  className,
}: {
  tone: 'amber' | 'teal'
  icon: LucideIcon
  title: string
  subtitle: string
  /** The full spoken label, when the visible text abbreviates it. */
  label?: string
  onPress: () => void
  className?: string
}) {
  return (
    <SelectableCard as="action" layout="row" surface="card" aria-label={label} onClick={onPress} className={cn('min-h-[56px]', className)}>
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
          tone === 'amber' ? 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]' : 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]',
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
        <span className="block text-xs text-[var(--color-brand-text-secondary)]">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-secondary)] rtl:rotate-180" aria-hidden />
    </SelectableCard>
  )
}
