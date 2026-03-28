'use client'

import { Label } from '@/components/ui/label'
import { EXPENSE_CATEGORIES } from '@/lib/constants/finance'
import type { ExpenseCategory } from '@/lib/store/types'

export function ExpenseCategoryChips({
  category,
  onChange,
}: {
  category: ExpenseCategory
  onChange: (c: ExpenseCategory) => void
}) {
  return (
    <div>
      <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Category</Label>
      <div className="flex flex-wrap gap-2">
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
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
