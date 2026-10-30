'use client'

import { MessageSquare, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { findBrandByKey, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { defaultPlan, tilePrice } from '@/lib/subscriptions/catalogDisplay'
import { useLocale, useT } from '@/lib/i18n'
import { BrandPriceTile } from './BrandPriceTile'
import { tilePriceText } from './subscriptionLabels'

const FIRST_RUN = ['netflix', 'shahid_vip', 'spotify', 'anghami', 'youtube_premium', 'apple_music'] as const

/** First run: six services with their usual price, then the one primary action and the SMS scan. */
export function SubscriptionsEmpty({
  region,
  onPickBrand,
  onAdd,
  onScan,
}: {
  region: CatalogRegion | null
  onPickBrand: (brandKey: string) => void
  onAdd: () => void
  onScan: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const ui = t.subscriptions.ui
  const tiles = FIRST_RUN.flatMap((key) => {
    const brand = findBrandByKey(key)
    const plan = brand && defaultPlan(brand, region)
    return brand && plan ? [{ brand, price: tilePriceText(tilePrice(plan, region), locale) }] : []
  })
  return (
    <EmptyState
      variant="card"
      title={ui.empty.title}
      description={ui.empty.sub}
      action={
        <div className="flex w-full flex-col gap-3.5 lg:flex-row lg:justify-center">
          <Button size="cta-block" className="lg:w-72" onClick={onAdd}>
            <Plus aria-hidden />
            {t.subscriptions.addSubscription}
          </Button>
          <Button size="cta-block" variant="outline" className="lg:w-72" onClick={onScan}>
            <MessageSquare aria-hidden />
            {ui.empty.scan}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
        {tiles.map(({ brand, price }) => (
          <BrandPriceTile key={brand.key} brand={brand} price={price} variant="quick" onPick={() => onPickBrand(brand.key)} />
        ))}
      </div>
    </EmptyState>
  )
}
