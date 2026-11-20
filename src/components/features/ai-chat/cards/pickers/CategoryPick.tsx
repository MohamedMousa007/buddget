'use client'

import { useMemo, useState } from 'react'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { OptionChip } from '@/components/ui/OptionChip'
import { useBuddgyCardCopy } from '@/lib/i18n/buddgyCardCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { topCategories } from './topCategories'

/** How many recent expenses rank the chips: enough to know the habit, cheap to count on every render. */
const RECENT = 200

export interface CategoryPickProps {
  value: string
  options: { value: string; label: string }[]
  onPick: (value: string) => void
  guessed?: boolean
}

/** Category as chips with their icons: the person's top five, then More for the rest. */
export function CategoryPick({ value, options, onPick, guessed = false }: CategoryPickProps) {
  const copy = useBuddgyCardCopy()
  const expenses = useFinanceStore((s) => s.expenses)
  const [all, setAll] = useState(false)
  const shown = useMemo(
    () => (all ? options : topCategories(options, expenses.slice(-RECENT).map((e) => e.category), value)),
    [all, options, expenses, value],
  )
  return (
    <div role="group" aria-label={copy.category.label} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-semibold">{copy.category.label}</span>
        {guessed ? <span className="text-xs text-[var(--color-brand-text-muted)]">{copy.guessed}</span> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => (
          <OptionChip key={o.value} selected={o.value === value} onClick={() => onPick(o.value)}>
            <CategoryGlyph category={o.value} className="size-4" />
            {o.label}
          </OptionChip>
        ))}
        {!all && options.length > shown.length ? (
          <OptionChip as="trigger" aria-expanded={false} onClick={() => setAll(true)}>
            {copy.category.more}
          </OptionChip>
        ) : null}
      </div>
    </div>
  )
}
