'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { Expense } from '@/lib/store/types'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditExpenseForm } from '@/hooks/useEditExpenseForm'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { ExpenseCategoryChips, PaymentMethodChips } from '@/components/features/expenses/ExpenseFormPickers'
import { useT } from '@/lib/i18n'

export function EditExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const f = useEditExpenseForm(expense, onClose)
  const t = useT()

  return (
    <div className="p-6">
      <ModalSheetHeader title={t.addExpense.editTitle} onClose={onClose} />

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelWhen}</Label>
          <Input
            type="date"
            value={f.date}
            onChange={(e) => f.setDate(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelDescription}</Label>
          <Input
            value={f.description}
            onChange={(e) => f.setDescription(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelAmount}</Label>
            <Input
              type="number"
              step="0.01"
              value={f.amount}
              onChange={(e) => {
                f.setAmount(e.target.value)
                f.setSubmitError('')
              }}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelCurrency}</Label>
            <FiatCurrencySelect
              value={f.currency}
              onChange={(c) => {
                f.setCurrency(c)
                f.setSubmitError('')
              }}
              className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
            />
          </div>
        </div>

        {f.submitError ? <p className="text-xs text-[var(--color-brand-red)]">{f.submitError}</p> : null}

        <ExpenseCategoryChips
          category={f.category}
          onChange={f.setCategory}
          options={f.categoryChipOptions}
          subcategory={f.subcategory}
          onSubcategoryChange={f.setSubcategory}
        />
        <PaymentMethodChips
          methods={f.paymentMethods}
          paymentMethodId={f.paymentMethodId}
          onChange={f.setPaymentMethodId}
        />

        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelRepeats}</Label>
          <Switch checked={f.isRecurring} onCheckedChange={f.setIsRecurring} />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelNotes}</Label>
          <Textarea
            value={f.notes}
            onChange={(e) => f.setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
          {t.common.neverMind}
        </button>
          <button
            type="button"
            onClick={f.handleSubmit}
            disabled={!f.description || !f.amount}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.addExpense.buttonSave}
          </button>
        </div>
      </div>
    </div>
  )
}
