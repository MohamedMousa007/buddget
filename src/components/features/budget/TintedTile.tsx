import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: 'size-9 rounded-xl [&_svg]:size-[18px]',
  md: 'size-11 rounded-[14px] [&_svg]:size-[22px]',
  lg: 'size-[52px] rounded-2xl [&_svg]:size-6',
  36: 'size-9 rounded-xl [&_svg]:size-[18px]',
  44: 'size-11 rounded-[14px] [&_svg]:size-[22px]',
  52: 'size-[52px] rounded-2xl [&_svg]:size-6',
} as const

/** The rounded tinted icon tile: 16% of `--color-cat-N` on the card; cat 0 is neutral. */
export function TintedTile({
  cat,
  size = 'md',
  className,
  children,
}: {
  cat: 0 | 1 | 2 | 3 | 4 | 5 | 6
  size?: keyof typeof SIZE
  className?: string
  children: ReactNode
}) {
  const style =
    cat === 0
      ? { color: 'var(--color-brand-text-secondary)', background: 'var(--color-brand-elevated)' }
      : {
          color: `var(--color-cat-${cat})`,
          background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))`,
        }
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', SIZE[size], className)}
      style={style}
      aria-hidden
    >
      {children}
    </span>
  )
}
