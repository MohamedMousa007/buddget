'use client'

import { cn } from '@/lib/utils'

/**
 * Colored circle with emoji or short initial — avoids fetching trademark logos.
 */
export function SubscriptionBrandIcon({
  color,
  emoji,
  initial,
  size = 'md',
  className,
}: {
  color: string
  emoji: string
  initial: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dim = size === 'lg' ? 'h-12 w-12 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center shrink-0 font-semibold text-white shadow-inner',
        dim,
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <span className="leading-none">{emoji || initial}</span>
    </div>
  )
}
