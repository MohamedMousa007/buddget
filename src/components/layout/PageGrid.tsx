import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageGridProps {
  primary: ReactNode
  /** Rail shown after `primary` on phone/tablet and beside it from lg. Omit for a single centred column. */
  secondary?: ReactNode
  /** Phone only: show the rail before `primary` (a rail that sits above the main column on phone). */
  railFirst?: boolean
  /** Without `secondary`, fill the wide column instead of the narrow one. */
  wide?: boolean
  className?: string
}

/** Hairline colour shared by every desktop structure line. */
export const PAGE_HAIRLINE = 'border-[var(--color-hairline)]'

/** Body shell from lg: capped column, 24px gutters. BODY_PT is the one shared gap under the hero band. */
const SHELL = 'mx-auto w-full max-w-[var(--page-max-wide)] lg:px-6'
const BODY_PT = 'lg:pt-[var(--page-body-pt)]'

/**
 * Page body below the hero band. Single column below lg (primary first, then secondary: the
 * phone order). From lg a hairline closes the hero band, primary fills and `secondary` is a
 * 22rem sticky rail split off by a vertical hairline; both start at the same y. Without
 * `secondary`, one column centred at `--page-max`. Phone spacing stays with the children.
 */
export function PageGrid({ primary, secondary, railFirst, wide, className }: PageGridProps) {
  if (!secondary) {
    return (
      <div className={cn('w-full lg:border-t', PAGE_HAIRLINE)}>
        <div className={cn(SHELL, BODY_PT, wide ? 'max-w-[var(--page-max)] lg:max-w-[var(--page-max-wide)]' : 'max-w-[var(--page-max)]', className)}>{primary}</div>
      </div>
    )
  }
  return (
    <div className={cn('w-full lg:border-t', PAGE_HAIRLINE)}>
      <div
        className={cn(
          SHELL,
          'grid grid-cols-1 gap-y-4 lg:grid-cols-[minmax(0,1fr)_calc(22rem+1.5rem+1px)]',
          className,
        )}
      >
        <div className={cn('min-w-0 lg:pe-6', BODY_PT)}>{primary}</div>
        <aside className={cn('min-w-0 lg:border-s lg:ps-6', railFirst && 'max-lg:order-first', BODY_PT, PAGE_HAIRLINE)}>
          <div className="lg:sticky lg:top-[calc(var(--app-header-h-lg)+var(--page-body-pt))]">{secondary}</div>
        </aside>
      </div>
    </div>
  )
}
