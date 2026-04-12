'use client'

import { Label } from '@/components/ui/label'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import type { CategoryChipOption } from '@/hooks/usePlanCategories'

export function ExpenseCategoryChips({
  category,
  onChange,
  options,
  subcategory,
  onSubcategoryChange,
}: {
  category: string
  onChange: (c: string) => void
  /** Plan-aware chip options. Falls back to legacy enum list when omitted. */
  options?: CategoryChipOption[]
  subcategory?: string
  onSubcategoryChange?: (s: string | undefined) => void
}) {
  const chips: CategoryChipOption[] =
    options && options.length > 0
      ? options
      : EXPENSE_ENTRY_CATEGORIES.map((c) => ({ id: c, label: c, subcategories: [] }))

  const selectedChip = chips.find((c) => c.id === category)
  const subs = selectedChip?.subcategories ?? []

  return (
    <div className="space-y-2">
      <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-1 block">Category</Label>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => {
              onChange(chip.id)
              onSubcategoryChange?.(undefined)
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === chip.id
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {chip.icon ? `${chip.icon} ${chip.label}` : chip.label}
          </button>
        ))}
      </div>

      {subs.length > 0 && onSubcategoryChange && (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-muted)] mb-1 block">Subcategory</Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSubcategoryChange(undefined)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                !subcategory
                  ? 'bg-[var(--color-brand-red)]/80 text-white'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-border)]'
              }`}
            >
              General
            </button>
            {subs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSubcategoryChange(sub.name)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  subcategory === sub.name
                    ? 'bg-[var(--color-brand-red)]/80 text-white'
                    : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-border)]'
                }`}
              >
                {sub.icon ? `${sub.icon} ${sub.name}` : sub.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PaymentMethodChips({
  methods,
  paymentMethodId,
  onChange,
}: {
  methods: { id: string; name: string }[]
  paymentMethodId: string
  onChange: (id: string) => void
}) {
  return (
    <div>
      <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Payment Method</Label>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onChange(method.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              paymentMethodId === method.id
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {method.name}
          </button>
        ))}
      </div>
    </div>
  )
}
