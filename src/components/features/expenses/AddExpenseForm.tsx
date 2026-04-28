'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import type { Currency } from '@/lib/store/types'
import type { CategoryChipOption } from '@/hooks/usePlanCategories'
import { ExpenseCategoryChips, PaymentMethodChips } from '@/components/features/expenses/ExpenseFormPickers'
import { useT } from '@/lib/i18n'
import { MODAL_BODY_SCROLL_CLASS, MODAL_AMOUNT_CLASS, MODAL_CONTROL_CLASS, MODAL_LABEL_CLASS } from '@/lib/modals/modalFormClasses'

export interface AddExpenseFormProps {
  date: string
  setDate: (v: string) => void
  description: string
  setDescription: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  category: string
  setCategory: (c: string) => void
  subcategory?: string
  setSubcategory?: (s: string | undefined) => void
  categoryChipOptions?: CategoryChipOption[]
  paymentMethodId: string
  setPaymentMethodId: (id: string) => void
  notes: string
  setNotes: (v: string) => void
  submitError: string
  setSubmitError: (v: string) => void
  paymentMethods: { id: string; name: string }[]
  /** Shown when a credit card payment method is selected. */
  creditCardOutstandingHint: { cardName: string; amountLabel: string } | null
}

/**
 * Scrollable field stack for the add-expense sheet (submit lives in the sheet shell).
 */
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
  subcategory,
  setSubcategory,
  categoryChipOptions,
  paymentMethodId,
  setPaymentMethodId,
  notes,
  setNotes,
  submitError,
  setSubmitError,
  paymentMethods,
  creditCardOutstandingHint,
}: AddExpenseFormProps) {
  const t = useT()
  const [notesOpen, setNotesOpen] = useState(false)
  const showNotes = notesOpen || Boolean(notes.trim())

  return (
    <div className={MODAL_BODY_SCROLL_CLASS}>
      <div>
        <label htmlFor="expense-date" className={MODAL_LABEL_CLASS}>
          {t.addExpense.labelWhen}
        </label>
        <Input
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
        />
      </div>

      <div>
        <label htmlFor="expense-desc" className={MODAL_LABEL_CLASS}>
          {t.addExpense.labelDescription}
        </label>
        <Input
          id="expense-desc"
          placeholder={t.addExpense.placeholderDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div className="min-w-0">
          <label htmlFor="expense-amt" className={MODAL_LABEL_CLASS}>
            {t.addExpense.labelAmount}
          </label>
          <Input
            id="expense-amt"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder={t.addExpense.placeholderAmount}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setSubmitError('')
            }}
            className={`mt-1.5 ${MODAL_AMOUNT_CLASS}`}
          />
        </div>
        <div className="w-[7.5rem] shrink-0">
          <label htmlFor="expense-cur" className={MODAL_LABEL_CLASS}>
            {t.addExpense.labelCurrency}
          </label>
          <FiatCurrencySelect
            id="expense-cur"
            value={currency}
            onChange={(c) => {
              setCurrency(c)
              setSubmitError('')
            }}
            className={`mt-1.5 w-full h-12 px-3 rounded-xl border border-[#2A2A38] bg-[#1A1A24] text-white text-sm focus:border-[#E50914]`}
          />
        </div>
      </div>

      {submitError ? <p className="text-xs text-[var(--color-brand-red)]">{submitError}</p> : null}

      <ExpenseCategoryChips
        category={category}
        onChange={setCategory}
        options={categoryChipOptions}
        subcategory={subcategory}
        onSubcategoryChange={setSubcategory}
      />

      <PaymentMethodChips
        methods={paymentMethods}
        paymentMethodId={paymentMethodId}
        onChange={setPaymentMethodId}
      />

      {creditCardOutstandingHint ? (
        <p className="text-[11px] text-[var(--color-brand-text-muted)] leading-snug" role="status">
          ⓘ{' '}
          {t.addExpense.creditCardOutstandingHint(
            creditCardOutstandingHint.cardName,
            creditCardOutstandingHint.amountLabel,
          )}
        </p>
      ) : null}

      {showNotes ?
        <div>
          <label htmlFor="expense-notes" className={MODAL_LABEL_CLASS}>
            {t.addExpense.labelNotes}
          </label>
          <Input
            id="expense-notes"
            placeholder={t.addExpense.placeholderNotes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
          />
        </div>
      : <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="text-left text-sm text-[#E50914]/90 hover:text-[#E50914] py-1"
        >
          Add note +
        </button>}
    </div>
  )
}
