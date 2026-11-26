import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A page's hero slot. Phone keeps the hero as it is drawn; from lg it sits at the top of the centred `--page-max`
 * column as a rounded card (Flow's look), on the same 24px gutter as the body.
 * - `bleed` (default): the hero is a full-bleed band; from lg it is clipped to the rounded card.
 * - `inset`: the hero is already a rounded card; it gets the phone gutter and, from lg, the centred column.
 */
export function PageHero({ inset = false, className, children }: { inset?: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        inset
          ? 'mx-auto w-full max-w-[var(--page-max)] px-4 pt-4 lg:px-6'
          : 'lg:mx-auto lg:mt-4 lg:max-w-[calc(var(--page-max)-3rem)] lg:overflow-hidden lg:rounded-3xl lg:[&>section]:border-b-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
