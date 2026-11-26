'use client'

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PickerRowProps {
  /** The field name on the start side ("Paid with", "Every"). */
  label: ReactNode
  /** The chosen value on the end side: text, a logo and name, or a `Pill`. */
  value?: ReactNode
  /** Makes the whole row the button. Without it the row is static (or holds its own control, like a `PillButton`). */
  onClick?: () => void
  /** Trailing chevron on a tappable row. Default on; pass false when the value is a `Pill`. */
  chevron?: boolean
  'aria-label'?: string
  className?: string
}

const ROW = 'flex min-h-[52px] w-full items-center gap-3 px-4 text-start'
const LABEL = 'w-[112px] shrink-0 text-[0.84375rem] text-[var(--color-brand-text-secondary)]'
const VALUE = 'flex min-w-0 flex-1 items-center justify-end gap-2 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]'

/**
 * One 52px row of a sheet's grouped list: the field name, then its value at the end. Rows sit in a
 * `<Card padding="none" divide>`; a tappable row opens the field's picker sheet.
 */
export function PickerRow({ label, value, onClick, chevron = true, 'aria-label': ariaLabel, className }: PickerRowProps) {
  const body = (
    <>
      <span className={LABEL}>{label}</span>
      <span className={VALUE}>
        {value}
        {onClick && chevron ? <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden /> : null}
      </span>
    </>
  )
  if (!onClick) return <div className={cn(ROW, className)}>{body}</div>
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cn(ROW, 'transition-colors hover:bg-[var(--color-brand-elevated)]', className)}>
      {body}
    </button>
  )
}
