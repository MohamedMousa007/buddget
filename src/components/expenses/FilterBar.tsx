'use client'

import { Search, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EXPENSE_FILTER_CATEGORIES } from '@/lib/constants/finance'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { usePlanCategories } from '@/hooks/usePlanCategories'
import { useT } from '@/lib/i18n'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
  methodFilter: string
  onMethodChange: (value: string) => void
  onExport: () => void
}

export function FilterBar({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  methodFilter,
  onMethodChange,
  onExport,
}: FilterBarProps) {
  const { paymentMethods } = useFinanceStore(useShallow((s) => ({ paymentMethods: s.paymentMethods })))
  const { hasPlan, categoryChipOptions } = usePlanCategories()
  const t = useT()

  const filterOptions = hasPlan
    ? categoryChipOptions.map((c) => ({ value: c.id, label: c.icon ? `${c.icon} ${c.label}` : c.label }))
    : EXPENSE_FILTER_CATEGORIES.filter((c) => c !== 'All').map((c) => ({
        value: c,
        label: t.categories[c as keyof typeof t.categories] ?? c,
      }))

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[var(--color-brand-card)]/90 backdrop-blur-xl border-b border-[var(--color-brand-border)] sticky top-[57px] z-20">
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="h-9 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
      >
        <option value="All">{t.expenses.filterAllCategories}</option>
        {filterOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={methodFilter}
        onChange={(e) => onMethodChange(e.target.value)}
        className="h-9 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
      >
        <option value="All">{t.expenses.filterAllMethods}</option>
        {paymentMethods.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <div className="relative flex-1 min-w-[150px]">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-text-muted)]" />
        <Input
          placeholder={t.expenses.searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="ps-9 h-9 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] text-sm"
        />
      </div>

      <button
        onClick={onExport}
        className="flex items-center gap-2 h-9 px-4 rounded-lg border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">{t.expenses.downloadData}</span>
      </button>
    </div>
  )
}
