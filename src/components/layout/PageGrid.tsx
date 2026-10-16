import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageGridProps {
  primary: ReactNode
  /** Rail shown after `primary` on phone/tablet and beside it from lg. Omit for a single centred column. */
  secondary?: ReactNode
  className?: string
}

/**
 * Single column below lg (primary first, then secondary: the phone order). At lg: primary
 * fills, secondary is a 22rem sticky rail. Without `secondary`, one column centred at
 * `--page-max`. Place inside a `wide` PageContainer.
 */
export function PageGrid({ primary, secondary, className }: PageGridProps) {
  if (!secondary) {
    return <div className={cn('mx-auto w-full max-w-[var(--page-max)]', className)}>{primary}</div>
  }
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-y-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-6',
        className,
      )}
    >
      <div className="min-w-0">{primary}</div>
      <aside className="min-w-0 lg:sticky lg:top-[calc(var(--app-header-h-lg)+1rem)]">{secondary}</aside>
    </div>
  )
}
