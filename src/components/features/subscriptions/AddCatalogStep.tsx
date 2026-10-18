'use client'

import { Cloud, Dumbbell, Ellipsis, Gamepad2, GraduationCap, Music, Newspaper, Plus, Search, ShoppingBag, Sparkles, Tv, Wifi, type LucideIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { defaultPlan, tilePrice, ADD_CATEGORIES, type AddCategory } from '@/lib/subscriptions/catalogDisplay'
import type { AddSubscriptionFormReturn } from '@/hooks/useAddSubscriptionForm'
import { useLocale, useT } from '@/lib/i18n'
import { BrandPriceTile } from './BrandPriceTile'
import { SectionLabel } from './SheetFrame'
import { tilePriceText } from './subscriptionLabels'

const CATEGORY_ICON: Record<AddCategory, LucideIcon> = {
  streaming: Tv,
  music: Music,
  gaming: Gamepad2,
  telecom: Wifi,
  ai: Sparkles,
  cloud: Cloud,
  fitness: Dumbbell,
  shopping: ShoppingBag,
  learning: GraduationCap,
  news: Newspaper,
  other: Ellipsis,
}

/** Step 1: search, category chips, the region's brands (no recents), and a Custom tile. */
export function AddCatalogStep({ form }: { form: AddSubscriptionFormReturn }) {
  const t = useT()
  const { locale } = useLocale()
  const ui = t.subscriptions.ui.add
  return (
    <>
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[var(--color-brand-text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <Input
          size="brand"
          value={form.search}
          onChange={(e) => form.setSearch(e.target.value)}
          placeholder={ui.search}
          aria-label={ui.search}
          className="ps-10"
        />
      </div>
      <div role="group" aria-label={t.subscriptions.ui.add.category} className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-6 md:px-6">
        {ADD_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c]
          return (
            <OptionChip
              key={c}
              size="sm"
              selected={form.category === c}
              onClick={() => form.setCategory(form.category === c ? null : c)}
            >
              <Icon aria-hidden strokeWidth={1.75} />
              {ui.categories[c]}
            </OptionChip>
          )
        })}
      </div>
      <section className="flex flex-col gap-2.5">
        <SectionLabel>{ui.popular}</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          {form.brands.map((b) => {
            const plan = defaultPlan(b, form.region)
            return (
              <BrandPriceTile
                key={b.key}
                brand={b}
                variant="grid"
                price={plan ? tilePriceText(tilePrice(plan, form.region), locale) : ''}
                onPick={() => form.pickBrand(b.key)}
              />
            )
          })}
          <button
            type="button"
            onClick={() => form.pickBrand('custom')}
            data-raw-button-ok="the dashed Custom tile: icon and label as one target"
            className="flex min-h-11 flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[var(--color-brand-border)] px-1 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-brand-focus)]/50"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]">
              <Plus className="size-6" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-xs font-semibold text-[var(--color-brand-text-primary)]">{ui.custom}</span>
          </button>
        </div>
      </section>
    </>
  )
}
