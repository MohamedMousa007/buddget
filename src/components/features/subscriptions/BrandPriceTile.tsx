'use client'

import { SelectableCard } from '@/components/ui/SelectableCard'
import type { SubscriptionBrand } from '@/lib/constants/subscriptionCatalog'
import { cn } from '@/lib/utils'
import { BrandTile } from './BrandTile'

/**
 * A service to tap, as the shared `SelectableCard` tile: logo, name and its usual price.
 * `quick` is the first-run card (40px logo, raised); `grid` is the add-flow cell (56px logo).
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
    <SelectableCard
      as="action"
      layout="tile"
      surface="card"
      onClick={onPick}
      className={cn('min-h-11 gap-1.5', quick ? 'px-2 py-3 shadow-[var(--shadow-sm)]' : 'px-1 py-2.5')}
    >
      <BrandTile brandKey={brand.key} name={brand.name} size={quick ? 40 : 56} />
      <span className="text-center text-xs font-semibold text-[var(--color-brand-text-primary)]">{brand.name}</span>
      <span className="font-mono-numbers text-[11px] text-[var(--color-brand-text-secondary)]">{price}</span>
    </SelectableCard>
  )
}
