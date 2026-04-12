'use client'

import { useState, useEffect, useRef } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import type { Currency, IncomeRecurringFrequency } from '@/lib/store/types'

const RECURRING_FREQ: { value: IncomeRecurringFrequency; label: string; amountHint: string }[] = [
  { value: 'monthly', label: 'Monthly', amountHint: 'Amount is per month.' },
  { value: 'biweekly', label: 'Bi-weekly', amountHint: 'Amount is per paycheck (26 per year).' },
  { value: 'weekly', label: 'Weekly', amountHint: 'Amount is per week.' },
]

export function AddIncomeSheet() {
  const { addIncomeSource, settings } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addIncome'

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [isRecurring, setIsRecurring] = useState(true)
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [notes, setNotes] = useState('')
  const prevIsOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency])

  const resetForm = () => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
    setRecurringFrequency('monthly')
    setDayOfMonth('1')
    setNotes('')
  }

  const handleSubmit = () => {
    if (!name || !amount || parseFloat(amount) <= 0) return

    addIncomeSource({
      name,
      amount: parseFloat(amount),
      currency: clampFiatToAllowed(settings, currency),
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
      notes: notes || undefined,
    })

    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
            <div className="p-6">
              <ModalSheetHeader title={t.addIncome.sheetTitle} onClose={handleClose} />

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelSource}</Label>
                  <Input
                    placeholder={t.addIncome.placeholderSource}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelAmount}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={t.addIncome.placeholderAmount}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers placeholder:text-[var(--color-brand-text-muted)]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelCurrency}</Label>
                    <FiatCurrencySelect
                      value={currency}
                      onChange={setCurrency}
                      className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelRecurring}</Label>
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                </div>

                {isRecurring && (
                  <>
                    <div>
                      <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelFrequency}</Label>
                      <select
                        value={recurringFrequency}
                        onChange={(e) => setRecurringFrequency(e.target.value as IncomeRecurringFrequency)}
                        className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
                      >
                        {RECURRING_FREQ.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">
                        {RECURRING_FREQ.find((f) => f.value === recurringFrequency)?.amountHint}
                        {' '}Budgets use a monthly equivalent (e.g. weekly × 52÷12).
                      </p>
                    </div>
                    {recurringFrequency === 'monthly' && (
                      <div>
                        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelDayOfMonth}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={dayOfMonth}
                          onChange={(e) => setDayOfMonth(e.target.value)}
                          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers w-24"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelNotes}</Label>
                  <Textarea
                    placeholder={t.addIncome.placeholderNotes}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] min-h-[60px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!name || !amount}
                    className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.addIncome.buttonSubmit}
                  </button>
                </div>
              </div>
            </div>
    </ModalShell>
  )
}
