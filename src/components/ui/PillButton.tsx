'use client'

import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { HIT_AREA } from '@/lib/ui/hitArea'

const PILL =
  'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-[var(--color-brand-elevated)] px-3 text-[0.875rem] font-medium text-[var(--color-brand-text-primary)] ' +
  "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/**
 * The outlined date chip a money sheet's header starts with ("Today · 12:00"): card fill, hairline border, secondary
 * text, as the light-touch sheets draw it. Pass as `className` to {@link PillButton} / {@link Pill} or DatePickerField.
 */
export const HEADER_PILL =
  'h-9 border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'

/** The soft pill a picker row shows its value in: a date, a day, a number, a frequency. Icon first (calendar, repeat). */
export function Pill({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn(PILL, className)}>
      {icon ? <span aria-hidden className="flex text-[var(--color-brand-text-secondary)]">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

export interface PillButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  icon?: ReactNode
  children: ReactNode
}

/** A {@link Pill} that is its own button (44px tap area), for a pill that sits outside a tappable row. */
export function PillButton({ icon, children, className, type = 'button', ...props }: PillButtonProps) {
  return (
    <button type={type} className={cn(HIT_AREA, PILL, 'hover:bg-[var(--color-brand-sunken)]', className)} {...props}>
      {icon ? <span aria-hidden className="flex text-[var(--color-brand-text-secondary)]">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  )
}
