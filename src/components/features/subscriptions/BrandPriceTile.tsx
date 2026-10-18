'use client'

import type { SubscriptionBrand } from '@/lib/constants/subscriptionCatalog'
import { cn } from '@/lib/utils'
import { BrandTile } from './BrandTile'

/**
 * A service to tap: logo, name and its usual price. `quick` is the first-run card (40px logo
 * on a raised card); `grid` is the add-flow cell (56px logo, hairline border).
 */
export function BrandPriceTile({
  brand,
  price,
  variant,
  onPick,
}: {
  brand: Pick<SubscriptionBrand, 'key' | 'name'>
  price: string
  variant: 'quick' | 'grid'
  onPick: () => void
}) {
  const quick = variant === 'quick'
  return (
    <button
      type="button"
      onClick={onPick}
      data-raw-button-ok="a catalog tile: logo, name and price in one tap target"
      className={cn(
        'flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50',
        quick
          ? 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-2 py-3 shadow-[var(--shadow-sm)]'
          : 'border-[var(--color-brand-border)] px-1 py-2.5',
      )}
    >
      <BrandTile brandKey={brand.key} name={brand.name} size={quick ? 40 : 56} />
      <span className="text-center text-xs font-semibold text-[var(--color-brand-text-primary)]">{brand.name}</span>
      <span className="font-mono-numbers text-[11px] text-[var(--color-brand-text-secondary)]">{price}</span>
    </button>
  )
}
