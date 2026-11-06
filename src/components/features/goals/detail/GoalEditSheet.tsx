'use client'

import { useState } from 'react'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { SheetFrame } from '@/components/features/subscriptions/SheetFrame'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/textarea'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, ExpenseCategory, Goal } from '@/lib/store/types'

const FIELD = 'h-[52px] rounded-[14px] bg-[var(--color-brand-elevated)]'
const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0)

/** Name, amount, currency and notes. Date, funding and pockets are edited from the plan card. */
export function GoalEditSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const t = useT()
  const upd = useFinanceStore((s) => s.updateGoal)
  const limit = goal.category === 'spending_control'
  const [name, setName] = useState(goal.name)
  const [amount, setAmount] = useState(String((limit ? goal.monthlySpendingLimit : goal.targetAmount) ?? ''))
  const [currency, setCurrency] = useState<Currency>(goal.currency)
  const [cat, setCat] = useState<string>(goal.spendingCategory ?? '')
  const [notes, setNotes] = useState(goal.notes ?? '')

  const save = () => {
    upd(goal.id, {
      name: name.trim() || goal.name,
      currency,
      notes: notes.trim() || null,
      ...(limit
        ? { monthlySpendingLimit: num(amount) || null, spendingCategory: cat ? (cat as ExpenseCategory) : null }
        : goal.category === 'debt_freedom' ? {} : { targetAmount: num(amount) }),
    })
    onClose()
  }

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={t.goals.detail.editTitle}
      zClassName="z-[110]"
      footer={<Button size="cta-block" onClick={save}>{t.goals.detail.editSave}</Button>}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.goals.goalName}</span>
        <Input size="brand" value={name} onChange={(e) => setName(e.target.value)} className="rounded-[14px] bg-[var(--color-brand-elevated)]" />
      </label>
      {goal.category !== 'debt_freedom' ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{limit ? t.goals.monthlyLimit : t.goals.targetAmount}</span>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <AmountField value={amount} onChange={setAmount} decimalsFor={currency} className={FIELD} aria-label={limit ? t.goals.monthlyLimit : t.goals.targetAmount} />
            </div>
            <div className="shrink-0">
              <FiatCurrencyField value={currency} onChange={setCurrency} compact className={FIELD} />
            </div>
          </div>
        </div>
      ) : null}
      {limit ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.goals.spendingCategory}</span>
          <SelectField
            value={cat}
            onChange={setCat}
            items={[
              { value: '', label: t.goals.allSpending },
              ...EXPENSE_ENTRY_CATEGORIES.map((c) => ({ value: c, label: t.expenseForm.categoryLabels[c] ?? c, glyph: <CategoryGlyph category={c} className="size-4" /> })),
            ]}
          />
        </div>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.goals.notes}</span>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-[14px] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm" />
      </label>
    </SheetFrame>
  )
}
