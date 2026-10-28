'use client'

import Image from 'next/image'
import { brandInitials, brandTileColors } from '@/lib/constants/brandTile'
import { logoAllowed } from '@/lib/constants/logoPolicy'
import { cn } from '@/lib/utils'

const SIZES = {
  40: { box: 'size-10 rounded-xl', pad: 'p-[5px]', text: 'text-[13px]' },
  44: { box: 'size-11 rounded-xl', pad: 'p-1.5', text: 'text-sm' },
  48: { box: 'size-12 rounded-[14px]', pad: 'p-1.5', text: 'text-[15px]' },
  56: { box: 'size-14 rounded-2xl', pad: 'p-[7px]', text: 'text-base' },
} as const

export type BrandTileSize = keyof typeof SIZES

/**
 * A service's logo on the `elevated` ground, never recoloured. Brands the logo policy does
 * not allow, and custom services, get their first two letters in `primary-ink`.
 */
export function BrandTile({
  brandKey,
  name,
  size = 40,
  className,
}: {
  brandKey?: string | null
  name: string
  size?: BrandTileSize
  className?: string
}) {
  const s = SIZES[size]
  const colors = brandTileColors(brandKey)
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-[var(--color-brand-elevated)]',
        s.box,
        className,
      )}
      style={colors && !(brandKey && logoAllowed(brandKey)) ? { backgroundColor: colors.bg } : undefined}
    >
      {brandKey && logoAllowed(brandKey) ? (
        <Image
          src={`/subscription-icons/${brandKey}.webp`}
          alt=""
          width={size}
          height={size}
          className={cn('size-full object-contain', s.pad)}
        />
      ) : (
        <span
          className={cn('font-bold tracking-wide', !colors && 'text-[var(--color-brand-primary-ink)]', s.text)}
          style={colors ? { color: colors.fg } : undefined}
        >
          {brandInitials(brandKey, name)}
        </span>
      )}
    </div>
  )
}
