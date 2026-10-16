import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Layout foundation (width/columns). Pages compose these; they never pick their own max widths.
 *
 * - PageContainer: centred content column. Default caps at `--page-max` (40rem), `wide` at
 *   `--page-max-wide` (72rem). Horizontal padding only (16px phone, 24px from lg); no vertical
 *   padding, so pages keep control of their own rhythm.
 * - PageGrid (PageGrid.tsx): one column below lg; at lg `primary` + `secondary`. DOM order = phone order.
 * - FullBleedHero: band background spans the full width, its content is capped like PageContainer.
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

export interface FullBleedHeroProps {
  /** Cap the inner content at `--page-max-wide` (match a wide body). */
  wide?: boolean
  /** Classes for the full-width band (background, borders, vertical padding). */
  className?: string
  /** Classes for the capped inner column. */
  innerClassName?: string
  children: ReactNode
}

export function FullBleedHero({ wide = false, className, innerClassName, children }: FullBleedHeroProps) {
  return (
    <div className={cn('w-full', className)}>
      <PageContainer wide={wide} className={innerClassName}>
        {children}
      </PageContainer>
    </div>
  )
}
