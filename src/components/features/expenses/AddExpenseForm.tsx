'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { ExpenseCategory, Currency } from '@/lib/store/types'
import { ExpenseCategoryChips, PaymentMethodChips } from '@/components/features/expenses/ExpenseFormPickers'
import { useT } from '@/lib/i18n'

export interface AddExpenseFormProps {
  date: string
  setDate: (v: string) => void
  description: string
  setDescription: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  category: ExpenseCategory
  setCategory: (c: ExpenseCategory) => void
  paymentMethodId: string
  setPaymentMethodId: (id: string) => void
  isRecurring: boolean
  setIsRecurring: (v: boolean) => void
  notes: string
  setNotes: (v: string) => void
  submitError: string
  setSubmitError: (v: string) => void
  paymentMethods: { id: string; name: string }[]
  onCancel: () => void
  onSubmit: () => void
}

export function AddExpenseForm({
  date,
  setDate,
  description,
  setDescription,
  amount,
  setAmount,
  currency,
  setCurrency,
  category,
  setCategory,
  paymentMethodId,
  setPaymentMethodId,
  isRecurring,
  setIsRecurring,
  notes,
  setNotes,
  submitError,
  setSubmitError,
  paymentMethods,
  onCancel,
  onSubmit,
}: AddExpenseFormProps) {
  const t = useT()
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelWhen}</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
        />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelDescription}</Label>
        <Input
          placeholder={t.addExpense.placeholderDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelAmount}</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={t.addExpense.placeholderAmount}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setSubmitError('')
            }}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelCurrency}</Label>
          <FiatCurrencySelect
            value={currency}
            onChange={(c) => {
              setCurrency(c)
              setSubmitError('')
            }}
            className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          />
        </div>
      </div>

      {submitError ? <p className="text-xs text-[var(--color-brand-red)]">{submitError}</p> : null}

      <ExpenseCategoryChips category={category} onChange={setCategory} />
      <PaymentMethodChips
        methods={paymentMethods}
        paymentMethodId={paymentMethodId}
        onChange={setPaymentMethodId}
      />

      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelRepeats}</Label>
        <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addExpense.labelNotes}</Label>
        <Textarea
          placeholder={t.addExpense.placeholderNotes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          {t.common.neverMind}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!description || !amount}
          className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.addExpense.buttonSubmit}
        </button>
      </div>
    </div>
  )
}
