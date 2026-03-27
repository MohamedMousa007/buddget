'use client'

import { useState } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { EXPENSE_CATEGORIES } from '@/lib/constants/finance'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { Expense, ExpenseCategory, Currency } from '@/lib/store/types'

export function EditExpenseSheet() {
  const { expenses } = useFinanceStore()
  const { activeModal, setActiveModal, editingExpenseId, setEditingExpenseId } = useSettingsStore()
  const isOpen = activeModal === 'editExpense'
  const expense = expenses.find((e) => e.id === editingExpenseId)

  const close = () => {
    setActiveModal(null)
    setEditingExpenseId(null)
  }

  const shellOpen = isOpen && !!expense

  return (
    <ModalShell open={shellOpen} onBackdropClick={close}>
      {expense ? <EditExpenseForm key={expense.id} expense={expense} onClose={close} /> : null}
    </ModalShell>
  )
}

function EditExpenseForm({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { updateExpense, paymentMethods, settings, exchangeRates } = useFinanceStore()

  useEscapeClose(true, onClose)

  const [date, setDate] = useState(expense.date)
  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(expense.amount.toString())
  const [currency, setCurrency] = useState<Currency>(expense.currency)
  const [category, setCategory] = useState<ExpenseCategory>(expense.category)
  const [paymentMethodId, setPaymentMethodId] = useState(expense.paymentMethodId)
  const [isRecurring, setIsRecurring] = useState(expense.isRecurring)
  const [notes, setNotes] = useState(expense.notes || '')
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = () => {
    if (!description || !amount || parseFloat(amount) <= 0) return

    const parsedAmount = parseFloat(amount)
    const cur = clampFiatToAllowed(settings, currency)
    const amountInBase = tryConvertCurrency(
      parsedAmount,
      cur,
      settings.baseCurrency,
      exchangeRates
    )
    if (amountInBase === null) {
      setSubmitError(
        `No exchange rate from ${cur} to ${settings.baseCurrency}. Update rates in Settings or pick another currency.`
      )
      return
    }
    setSubmitError('')

    updateExpense(expense.id, {
      date,
      description,
      category,
      amount: parsedAmount,
      currency: cur,
      amountInBaseCurrency: amountInBase,
      paymentMethodId,
      isRecurring,
      notes: notes || undefined,
    })

    onClose()
  }

  return (
    <div className="p-6">
      <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Edit Expense</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setSubmitError('')
              }}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
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

        {submitError ? (
          <p className="text-xs text-[var(--color-brand-red)]">{submitError}</p>
        ) : null}

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Category</Label>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
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

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Payment Method</Label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethodId(method.id)}
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

        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Recurring?</Label>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>

        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!description || !amount}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
