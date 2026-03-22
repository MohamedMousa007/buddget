'use client'

import { useState, useEffect, useMemo } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { computeDebtPaymentRecord, convertPaymentToDebtUnit, isDebtFullyPaid } from '@/lib/utils/calculations'
import { formatCurrency } from '@/lib/utils/formatters'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { Currency, DebtRecurringFrequency } from '@/lib/store/types'

const FREQUENCIES: { value: DebtRecurringFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'weekly', label: 'Weekly' },
]

export function AddRecurringDebtPaymentSheet() {
  const {
    addRecurringDebtPayment,
    debts,
    debtPayments,
    paymentMethods,
    settings,
    exchangeRates,
    goldPricePerGram,
  } = useFinanceStore()
  const { activeModal, setActiveModal } = useSettingsStore()
  const isOpen = activeModal === 'addRecurringDebtPayment'

  const payableDebts = useMemo(
    () => debts.filter((d) => !isDebtFullyPaid(d, debtPayments)),
    [debts, debtPayments]
  )

  const [selectedDebtId, setSelectedDebtId] = useState(payableDebts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState<string>(settings.baseCurrency)
  const [frequency, setFrequency] = useState<DebtRecurringFrequency>('monthly')
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const selectedDebt = debts.find((d) => d.id === selectedDebtId)

  const resetForm = () => {
    setAmount('')
    setPaymentCurrency(settings.baseCurrency)
    setFrequency('monthly')
    setNextDueDate(new Date().toISOString().slice(0, 10))
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    setIsActive(true)
    setNotes('')
    setError('')
  }

  const close = () => {
    resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, close)

  useEffect(() => {
    if (!isOpen) return
    /* eslint-disable react-hooks/set-state-in-effect -- reset defaults when opening */
    if (payableDebts.length > 0) {
      const sel = debts.find((d) => d.id === selectedDebtId)
      if (!sel || isDebtFullyPaid(sel, debtPayments)) {
        setSelectedDebtId(payableDebts[0].id)
      }
    }
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, payableDebts, debts, debtPayments, selectedDebtId, paymentMethods])

  const handleSubmit = () => {
    if (!selectedDebtId || !selectedDebt || !amount) return
    const n = parseFloat(amount)
    if (Number.isNaN(n) || n <= 0) return

    setError('')
    const check = computeDebtPaymentRecord(
      selectedDebt,
      n,
      paymentCurrency,
      settings.baseCurrency,
      exchangeRates,
      goldPricePerGram,
      debtPayments
    )
    if (!check.ok) {
      setError(check.error)
      return
    }

    addRecurringDebtPayment({
      debtId: selectedDebtId,
      amount: n,
      currency: paymentCurrency as Currency,
      paymentMethodId: paymentMethodId || paymentMethods[0]?.id || '',
      frequency,
      nextDueDate,
      isActive,
      notes: notes || undefined,
    })
    close()
  }

  const preview = () => {
    if (!amount || !selectedDebt) return null
    const n = parseFloat(amount)
    if (Number.isNaN(n) || n <= 0) return null
    if (selectedDebt.isGold && paymentCurrency !== 'XAU') {
      const grams = convertPaymentToDebtUnit(
        n,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${grams.toFixed(2)}g of ${selectedDebt.goldKarat || 24}K gold`
    }
    if (!selectedDebt.isGold && paymentCurrency !== selectedDebt.currency) {
      const converted = convertPaymentToDebtUnit(
        n,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${formatCurrency(converted, selectedDebt.currency)}`
    }
    return null
  }

  return (
    <ModalShell open={isOpen} onBackdropClick={close}>
      <div className="p-6">
        <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recurring debt payment</h3>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
          </button>
        </div>

        <p className="text-xs text-[var(--color-brand-text-muted)] mb-4">
          When the next due date arrives (or is in the past), Buddget records the payment and a Debt expense, then
          advances the schedule. Same rules as a manual payment (rates, no overpay).
        </p>

        {payableDebts.length === 0 ? (
          <p className="text-sm text-[var(--color-brand-text-muted)]">
            No debts with a remaining balance. Pay off or add a debt first.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Debt</Label>
              <select
                value={selectedPayableId(payableDebts, selectedDebtId)}
                onChange={(e) => setSelectedDebtId(e.target.value)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                {payableDebts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.isGold ? `${d.goldKarat}K gold` : d.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount per payment</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setError('')
                  }}
                  className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                />
                <select
                  value={paymentCurrency}
                  onChange={(e) => {
                    setPaymentCurrency(e.target.value)
                    setError('')
                  }}
                  className="w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                >
                  {FIAT_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {selectedDebt?.isGold ? (
                    <option value="XAU">Gold (grams)</option>
                  ) : null}
                </select>
              </div>
            </div>

            {error ? <p className="text-xs text-[var(--color-brand-red)]">{error}</p> : null}
            {preview() ? (
              <p className="text-xs text-[var(--color-brand-gold)]">{preview()}</p>
            ) : null}

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Frequency</Label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as DebtRecurringFrequency)}
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Next due date</Label>
              <Input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Paid via</Label>
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
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[50px]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedDebtId || !amount || payableDebts.length === 0}
                className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50"
              >
                Save schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function selectedPayableId(payable: { id: string }[], current: string): string {
  if (payable.some((d) => d.id === current)) return current
  return payable[0]?.id ?? ''
}
