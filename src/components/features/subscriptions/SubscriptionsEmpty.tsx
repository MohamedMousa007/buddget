'use client'

import { Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { findBrandByKey, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { BrandTile } from './BrandTile'

const FIRST_RUN = ['netflix', 'spotify', 'shahid_vip'] as const

/** First run (Light touch `emptysubs`): three services to tap for their usual price, Scan my SMS, then Add one myself. */
export function SubscriptionsEmpty({
  onPickBrand,
  onAdd,
  onScan,
}: {
  region?: CatalogRegion | null
  onPickBrand: (brandKey: string) => void
  onAdd: () => void
  onScan: () => void
}) {
  const c = useDebtsSubsLtCopy().subs.empty
  const brands = FIRST_RUN.flatMap((key) => {
    const brand = findBrandByKey(key)
    return brand ? [brand] : []
  })
  return (
    <EmptyState
      variant="card"
      icon={<Repeat strokeWidth={1.8} />}
      title={c.title}
      description={c.body}
      action={
        <div className="flex w-full flex-col items-stretch gap-1 lg:items-center">
          <Button size="cta-block" className="lg:w-72" onClick={onScan}>{c.scan}</Button>
          <Button variant="link" size="touch" className="font-semibold text-[var(--color-brand-primary-ink)]" onClick={onAdd}>{c.addMyself}</Button>
        </div>
      }
    >
      <div className="flex justify-center gap-1">
        {brands.map((brand) => (
          <IconButton key={brand.key} aria-label={brand.name} onClick={() => onPickBrand(brand.key)} size="lg">
            <BrandTile brandKey={brand.key} name={brand.name} size={40} />
          </IconButton>
        ))}
      </div>
    </EmptyState>
  )
}
