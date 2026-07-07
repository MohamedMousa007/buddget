'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Renders the brand’s app icon from `/public/subscription-icons/{brandKey}.png`.
 * On load error, falls back to a rounded square with `initial` (and optional `emoji` as label).
 */
export function SubscriptionBrandIcon({
  brandKey,
  color,
  emoji,
  initial,
  size = 'md',
  className,
}: {
  brandKey?: string | null
  color: string
  /** Kept for API compatibility; fallback prefers `initial`. */
  emoji?: string
  initial: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const px = size === 'lg' ? 48 : size === 'sm' ? 32 : 40
  const radius = size === 'lg' ? 'rounded-xl' : size === 'sm' ? 'rounded-lg' : 'rounded-md'
  const label = (initial || emoji || '?').trim()

  if (brandKey) {
    return (
      <div
        className={cn('relative shrink-0 overflow-hidden bg-[var(--color-brand-elevated)]', radius, className)}
        style={{ width: px, height: px }}
      >
        <Image
          src={`/subscription-icons/${brandKey}.png`}
          alt=""
          width={px}
          height={px}
          className="h-full w-full object-cover"
          sizes={`${px}px`}
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <div
          className={cn(
            'absolute inset-0 hidden items-center justify-center font-semibold text-white',
            radius
          )}
          style={{ backgroundColor: color, fontSize: px * 0.38 }}
        >
          {label}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold text-white',
        radius,
        className
      )}
      style={{ width: px, height: px, backgroundColor: color, fontSize: px * 0.38 }}
    >
      {label}
    </div>
  )
}
