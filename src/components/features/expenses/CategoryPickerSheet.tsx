'use client'

import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { PickerSheet } from '@/components/ui/PickerSheet'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { EXPENSE_CATEGORY_GRID } from '@/lib/constants/categoryGrid'
import { categoryChipColors } from '@/lib/expenses/categoryChip'
import { categoryBudget } from '@/lib/flow/categoryBudget'
import { useMonthlyStats } from '@/hooks/useMonthlyStats'
import { useT } from '@/lib/i18n'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { formatWhole } from '@/lib/utils/formatters'

export interface CategoryPickerSheetProps {
  open: boolean
  value: string
  onChange: (category: string) => void
  onClose: () => void
  /**
   * The edited expense's stored amount in base currency and its category: that spend is already in the month's
   * totals, so it is given back to its own category's "left".
   */
  own?: { category: string; amountBase: number }
}

/** The expense's category, as tiles that show what is left of each one's budget this month. Closes on pick. */
export function CategoryPickerSheet({ open, value, onChange, onClose, own }: CategoryPickerSheetProps) {
  const t = useT()
  const lt = useFlowLtCopy()
  const stats = useMonthlyStats()
  return (
    <PickerSheet open={open} onClose={onClose} title={t.expenseForm.category} subtitle={lt.expense.catPickSub} zIndexClassName="z-[120]">
      <div role="radiogroup" aria-label={t.expenseForm.category} className="grid grid-cols-2 gap-2 pb-2">
        {EXPENSE_CATEGORY_GRID.map((c) => {
          const colors = categoryChipColors(c.id)
          const b = c.nonspend ? null : categoryBudget(c.id, stats.categoryBudgetCaps, stats.categorySpending)
          const back = b && own && categoryBudget(own.category, stats.categoryBudgetCaps, {})?.row === b.row ? own.amountBase : 0
          const left = b ? b.left + back : 0
          const pct = b ? Math.max(0, (b.cap - left) / b.cap) : 0
          const tone = pct > 1 ? 'var(--color-brand-red)' : pct >= 0.8 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)'
          return (
            <SelectableCard
              key={c.id}
              layout="stack"
              surface="card"
              selected={c.id === value}
              onClick={() => {
                onChange(c.id)
                onClose()
              }}
              className="items-start"
            >
              <span aria-hidden className="flex size-9 items-center justify-center rounded-[11px]" style={{ background: colors.bg, color: colors.fg }}>
                <CategoryIcon category={c.id} className="size-[18px]" />
              </span>
              <span className="text-[0.875rem] font-semibold text-[var(--color-brand-text-primary)]">{t.expenseForm.categoryLabels[c.id] ?? c.id}</span>
              {b ? (
                <>
                  <span aria-hidden className="block h-1 w-full rounded-full bg-[var(--color-brand-elevated)]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: tone }} />
                  </span>
                  <span dir="auto" className={`font-mono-numbers text-xs ${left < 0 ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-secondary)]'}`}>
                    {left >= 0 ? lt.expense.catLeft(formatWhole(left)) : lt.expense.catOver(formatWhole(-left))}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[var(--color-brand-text-muted)]">{c.nonspend ? lt.expense.moneyMove : lt.filters.noBudget}</span>
              )}
            </SelectableCard>
          )
        })}
      </div>
    </PickerSheet>
  )
}
