'use client'

import { useMemo } from 'react'
import {
  CATALOG_SECTION_ORDER,
  getCatalogSectionForBrandKey,
  type SubscriptionBrand,
} from '@/lib/constants/subscriptionCatalog'
import { SubscriptionBrandIcon } from '@/components/features/subscriptions/SubscriptionBrandIcon'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/types'
import { cn } from '@/lib/utils'

function sectionLabel(t: Dictionary['subscriptions'], id: (typeof CATALOG_SECTION_ORDER)[number]) {
  switch (id) {
    case 'catStreaming':
      return t.catStreaming
    case 'catMusic':
      return t.catMusic
    case 'catCloudAi':
      return t.catCloudAi
    case 'catGaming':
      return t.catGaming
    case 'catFitness':
      return t.catFitness
    default:
      return t.catOther
  }
}

/**
 * Grouped brand tiles for catalog step 1.
 */
export function SubscriptionCatalogGrid({
  brands,
  onPick,
  onCustom,
}: {
  brands: SubscriptionBrand[]
  onPick: (b: SubscriptionBrand) => void
  onCustom: () => void
}) {
  const t = useT()
  const grouped = useMemo(() => {
    const m = new Map<string, SubscriptionBrand[]>()
    for (const id of CATALOG_SECTION_ORDER) {
      m.set(id, [])
    }
    for (const b of brands) {
      const sec = getCatalogSectionForBrandKey(b.key)
      m.get(sec)!.push(b)
    }
    return m
  }, [brands])

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pe-1">
      {CATALOG_SECTION_ORDER.map((sec) => {
        const list = grouped.get(sec) ?? []
        if (list.length === 0) return null
        return (
          <div key={sec}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-2">
              {sectionLabel(t.subscriptions, sec)}
            </p>
            <div className="flex flex-wrap gap-2">
              {list.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onPick(b)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border border-[var(--color-brand-border)]',
                    'bg-[var(--color-brand-elevated)] px-3 py-2 text-left hover:bg-[var(--color-brand-card)] transition-colors',
                    'min-w-[8rem]'
                  )}
                >
                  <SubscriptionBrandIcon color={b.color} emoji={b.emoji} initial={b.initial} size="sm" />
                  <span className="text-xs font-medium text-[var(--color-brand-text-primary)] truncate">
                    {b.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <div>
        <button
          type="button"
          onClick={onCustom}
          className="w-full flex items-center gap-2 rounded-xl border border-dashed border-[var(--color-brand-border)] px-3 py-3 text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          <span aria-hidden>✏️</span>
          {t.subscriptions.customSubscription}
        </button>
      </div>
    </div>
  )
}
