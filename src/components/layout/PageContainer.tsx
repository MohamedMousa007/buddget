import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Layout foundation (width/columns). Pages compose these; they never pick their own max widths.
 *
 * - PageContainer: centred content column. Default caps at `--page-max` (40rem), `wide` at
 *   `--page-max-wide` (72rem). Horizontal padding only (16px phone, 24px from lg); no vertical
 *   padding, so pages keep control of their own rhythm.
 * - PageGrid (PageGrid.tsx): one column below lg; at lg `primary` + `secondary`. DOM order = phone order.
 * - PageBody: the standard body for pages without a PageGrid (16px phone / 24px lg gutters, shared gap under
 *   the header or hero, no bottom padding: AppShell owns the bottom clearance).
 * - PageDivider: the lg-only hairline between major sections.
 */
export interface PageContainerProps {
  /** Use the wide cap (`--page-max-wide`) instead of `--page-max`. */
  wide?: boolean
  as?: ElementType
  className?: string
  children: ReactNode
}

export function PageContainer({ wide = false, as: Tag = 'div', className, children }: PageContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full px-4 lg:px-6',
        wide ? 'max-w-[var(--page-max-wide)]' : 'max-w-[var(--page-max)]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export interface PageBodyProps {
  /** Cap at `--page-max` instead of `--page-max-wide`. */
  narrow?: boolean
  className?: string
  children: ReactNode
}

export function PageBody({ narrow = false, className, children }: PageBodyProps) {
  return (
    <PageContainer
      wide={!narrow}
      className={cn('pt-4 lg:pt-[var(--page-body-pt)]', className)}
    >
      {children}
    </PageContainer>
  )
}

export function PageDivider({ className }: { className?: string }) {
  return <hr aria-hidden className={cn('hidden h-px border-0 bg-[var(--color-hairline)] lg:block', className)} />
}
