'use client'

import { BRAND_ICONS } from '@/lib/constants/subscriptionIcons'
import { cn } from '@/lib/utils'

/**
 * Branded inline SVG when `brandKey` maps in `BRAND_ICONS`; otherwise a rounded-square
 * tile (iOS-style) with emoji or initial — not a circle.
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
  emoji: string
  initial: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const px = size === 'lg' ? 48 : size === 'sm' ? 32 : 40

  if (brandKey && BRAND_ICONS[brandKey]) {
    return <div className={cn('shrink-0', className)}>{BRAND_ICONS[brandKey].icon(px)}</div>
  }

  const r = px * 0.22
  const label = emoji || initial
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width={px} height={px} rx={r} fill={color} />
      <text
        x="50%"
        y="54%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontSize={px * 0.32}
        fontWeight="600"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      >
        {label}
      </text>
    </svg>
  )
}
