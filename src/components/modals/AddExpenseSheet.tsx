'use client'

import { useState, useEffect, useRef } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { EXPENSE_CATEGORIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import type { ExpenseCategory, Currency } from '@/lib/store/types'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'

function matchPaymentMethod(
  hint: string | undefined,
  methods: { id: string; name: string }[]
): string {
  if (!hint) return methods.find((m) => m.name === 'Bank Transfer')?.id || methods[0]?.id || ''
  const lower = hint.toLowerCase()
  const match = methods.find((m) => m.name.toLowerCase().includes(lower))
    || methods.find((m) => lower.includes(m.name.toLowerCase()))
  return match?.id || methods[0]?.id || ''
}

export function AddExpenseSheet() {
  const { addExpense, paymentMethods, settings } = useFinanceStore()
  const { activeModal, setActiveModal, expensePrefill, setExpensePrefill } = useSettingsStore()
  const isOpen = activeModal === 'addExpense'

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [category, setCategory] = useState<ExpenseCategory>('Food')
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [isRecurring, setIsRecurring] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitError, setSubmitError] = useState('')
  const skipNextDefaultCurrencySync = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- apply AI/sheet prefill when opening */
    if (isOpen && expensePrefill) {
      skipNextDefaultCurrencySync.current = true
      if (expensePrefill.date) setDate(expensePrefill.date)
      if (expensePrefill.description) setDescription(expensePrefill.description)
      if (expensePrefill.amount) setAmount(expensePrefill.amount)
      if (expensePrefill.currency && FIAT_CURRENCIES.includes(expensePrefill.currency as Currency)) {
        setCurrency(clampFiatToAllowed(settings, expensePrefill.currency as Currency))
      }
      if (expensePrefill.category && EXPENSE_CATEGORIES.includes(expensePrefill.category as ExpenseCategory)) {
        setCategory(expensePrefill.category as ExpenseCategory)
      }
      if (expensePrefill.paymentMethod) {
        setPaymentMethodId(matchPaymentMethod(expensePrefill.paymentMethod, paymentMethods))
      }
      if (expensePrefill.notes) setNotes(expensePrefill.notes)

      setExpensePrefill(null)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, expensePrefill, setExpensePrefill, paymentMethods, settings])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- default currency when opening without AI prefill */
    if (!isOpen || expensePrefill) return
    if (skipNextDefaultCurrencySync.current) {
      skipNextDefaultCurrencySync.current = false
      return
    }
    setCurrency(settings.baseCurrency)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, expensePrefill, settings.baseCurrency])

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setCategory('Food')
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    setIsRecurring(false)
    setNotes('')
    setSubmitError('')
  }

  const handleSubmit = () => {
    if (!description || !amount || parseFloat(amount) <= 0) return

    const parsedAmount = parseFloat(amount)
    setSubmitError('')

    const cur = clampFiatToAllowed(settings, currency)

    addExpense({
      date,
      description,
      category,
      amount: parsedAmount,
      currency: cur,
      paymentMethodId,
      isRecurring,
      notes: notes || undefined,
    })

    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    setSubmitError('')
    resetForm()
    setExpensePrefill(null)
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
            <div className="p-6">
              <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Add Expense</h3>
                <button
                  onClick={handleClose}
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
                    placeholder="What did you spend on?"
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
                      placeholder="0.00"
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
                    placeholder="Any extra details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!description || !amount}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Expense →
                  </button>
                </div>
              </div>
            </div>
    </ModalShell>
  )
}
