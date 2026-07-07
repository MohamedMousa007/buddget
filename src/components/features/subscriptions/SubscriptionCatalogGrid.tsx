'use client'

import { useMemo, type ReactNode } from 'react'
import {
  CATALOG_SECTION_ORDER,
  POPULAR_BRAND_KEYS,
  type CatalogSectionKey,
  type SubscriptionBrand,
} from '@/lib/constants/subscriptionCatalog'
import { SubscriptionBrandIcon } from '@/components/features/subscriptions/SubscriptionBrandIcon'
import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/types'
import { cn } from '@/lib/utils'

function sectionLabel(t: Dictionary['subscriptions'], id: CatalogSectionKey) {
  switch (id) {
    case 'catAiProductivity':
      return t.catAiProductivity
    case 'catStreaming':
      return t.catStreaming
    case 'catMusic':
      return t.catMusic
    case 'catCloudStorage':
      return t.catCloudStorage
    case 'catGaming':
      return t.catGaming
    case 'catVpn':
      return t.catVpn
    case 'catFitness':
      return t.catFitness
    case 'catReading':
      return t.catReading
    case 'catCommunication':
      return t.catCommunication
    case 'catTelecom':
      return t.catTelecom
    default:
      return t.catOther
  }
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-text-muted)] mb-2">
      {children}
    </p>
  )
}

function BrandTile({ b, onPick }: { b: SubscriptionBrand; onPick: (x: SubscriptionBrand) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(b)}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-[var(--color-brand-border)]',
        'bg-[var(--color-brand-elevated)] p-2 text-center transition-colors',
        'hover:bg-[var(--color-brand-card)] min-h-[5.5rem] justify-start'
      )}
    >
      <SubscriptionBrandIcon
        brandKey={b.key}
        color={b.color}
        emoji={b.emoji}
        initial={b.initial}
        size="lg"
        className="mx-auto"
      />
      <span className="text-xs font-medium leading-tight line-clamp-2 text-[var(--color-brand-text-primary)] w-full">
        {b.name}
      </span>
    </button>
  )
}

/**
 * Custom row, POPULAR, then category sections — 4-column icon grid; search handled by parent.
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

  const popular = useMemo(() => {
    const keySet = new Set(brands.map((b) => b.key))
    return POPULAR_BRAND_KEYS.filter((k) => keySet.has(k))
      .map((k) => brands.find((b) => b.key === k))
      .filter((b): b is SubscriptionBrand => Boolean(b))
  }, [brands])

  const popularKeySet = useMemo(() => new Set(popular.map((b) => b.key)), [popular])

  const bySection = useMemo(() => {
    const m = new Map<CatalogSectionKey, SubscriptionBrand[]>()
    for (const id of CATALOG_SECTION_ORDER) {
      m.set(id, [])
    }
    for (const b of brands) {
      m.get(b.catalogSection)?.push(b)
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return m
  }, [brands])

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pe-1">
      <div>
        <button
          type="button"
          onClick={onCustom}
          className={cn(
            'w-full flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--color-brand-border)]',
            'px-4 py-3 text-left hover:bg-[var(--color-brand-elevated)] transition-colors'
          )}
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="text-lg shrink-0" aria-hidden>
              ✏️
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-brand-text-primary)]">
                {t.subscriptions.customSubscription}
              </span>
              <span className="block text-xs text-[var(--color-brand-text-muted)] mt-0.5">
                {t.subscriptions.customSubscriptionHint}
              </span>
            </span>
          </span>
          <span className="text-[var(--color-brand-text-muted)] shrink-0" aria-hidden>
            →
          </span>
        </button>
      </div>

      {popular.length > 0 ? (
        <div>
          <SectionHeader>{t.subscriptions.catPopular}</SectionHeader>
          <div className="grid grid-cols-4 gap-2">
            {popular.map((b) => (
              <BrandTile key={`pop-${b.key}`} b={b} onPick={onPick} />
            ))}
          </div>
        </div>
      ) : null}

      {CATALOG_SECTION_ORDER.map((sec) => {
        const list = (bySection.get(sec) ?? []).filter((b) => !popularKeySet.has(b.key))
        if (list.length === 0) return null
        return (
          <div key={sec}>
            <SectionHeader>{sectionLabel(t.subscriptions, sec)}</SectionHeader>
            <div className="grid grid-cols-4 gap-2">
              {list.map((b) => (
                <BrandTile key={b.key} b={b} onPick={onPick} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
