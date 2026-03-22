'use client'

import { useState, useEffect } from 'react'
import { useEscapeClose } from '@/lib/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { X } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { convertPaymentToDebtUnit, goldGramsToMoney, moneyToGoldGrams } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DEBT_FIAT_CURRENCIES, FIAT_CURRENCIES } from '@/lib/constants/finance'
import type { DebtCurrency, GoldKarat } from '@/lib/store/types'

export function AddDebtSheet() {
  const store = useFinanceStore()
  const { addDebt, addDebtPayment, addExpense, debts, paymentMethods, settings, exchangeRates, goldPricePerGram } = store
  const {
    activeModal,
    setActiveModal,
    debtSheetPaymentOnly,
    debtSheetPrefillDebtId,
    resetDebtSheetIntent,
  } = useSettingsStore()
  const isOpen = activeModal === 'addDebt'

  const [mode, setMode] = useState<'new' | 'payment'>('new')

  const [name, setName] = useState('')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [currency, setCurrency] = useState<DebtCurrency>('EGP')
  const [isGold, setIsGold] = useState(false)
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [notes, setNotes] = useState('')

  const [selectedDebtId, setSelectedDebtId] = useState(debts[0]?.id || '')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCurrency, setPaymentCurrency] = useState<string>(settings.baseCurrency)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState(
    () => paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
  )
  const [paymentRateError, setPaymentRateError] = useState('')

  const selectedDebt = debts.find((d) => d.id === selectedDebtId)

  const closeSheet = () => {
    resetDebtSheetIntent()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, closeSheet)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- default debt row when list loads */
    if (debts.length > 0 && !selectedDebtId) {
      setSelectedDebtId(debts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [debts, selectedDebtId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync tab/debt when opening from Record Payment */
    if (!isOpen) return
    if (debtSheetPaymentOnly && debtSheetPrefillDebtId) {
      setMode('payment')
      setSelectedDebtId(debtSheetPrefillDebtId)
    } else if (!debtSheetPaymentOnly) {
      setMode('new')
    }
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, debtSheetPaymentOnly, debtSheetPrefillDebtId, paymentMethods])

  const resetForm = () => {
    setName('')
    setPerson('')
    setDescription('')
    setStartingBalance('')
    setCurrency('EGP')
    setIsGold(false)
    setNotes('')
    setPaymentAmount('')
    setPaymentCurrency(settings.baseCurrency)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentNotes('')
    setPaymentRateError('')
  }

  const handleAddDebt = () => {
    if (!name || !person || !startingBalance) return

    addDebt({
      name,
      person,
      description: description || undefined,
      startingBalance: parseFloat(startingBalance),
      currency: isGold ? 'XAU' : currency,
      isGold,
      goldKarat: isGold ? goldKarat : undefined,
      notes: notes || undefined,
    })

    resetForm()
    closeSheet()
  }

  const handleAddPayment = () => {
    if (!selectedDebtId || !paymentAmount || !selectedDebt) return

    const amount = parseFloat(paymentAmount)
    if (Number.isNaN(amount) || amount <= 0) return

    setPaymentRateError('')

    let amountInBase: number
    let amountInDebtUnit: number

    if (paymentCurrency === 'XAU' && selectedDebt.isGold) {
      amountInDebtUnit = amount
      amountInBase = goldGramsToMoney(amount, goldPricePerGram, selectedDebt.goldKarat)
    } else {
      const inBase = tryConvertCurrency(
        amount,
        paymentCurrency,
        settings.baseCurrency,
        exchangeRates
      )
      if (inBase === null) {
        setPaymentRateError(
          `No exchange rate from ${paymentCurrency} to ${settings.baseCurrency}. Update rates in Settings.`
        )
        return
      }
      amountInBase = inBase

      if (selectedDebt.isGold) {
        amountInDebtUnit = moneyToGoldGrams(amountInBase, goldPricePerGram, selectedDebt.goldKarat)
      } else {
        const inDebtUnit = tryConvertCurrency(
          amount,
          paymentCurrency,
          selectedDebt.currency,
          exchangeRates
        )
        if (inDebtUnit === null) {
          setPaymentRateError(
            `No exchange rate from ${paymentCurrency} to debt currency ${selectedDebt.currency}.`
          )
          return
        }
        amountInDebtUnit = inDebtUnit
      }
    }

    const rateAtEntry = amount > 0 ? amountInBase / amount : 1

    addDebtPayment({
      debtId: selectedDebtId,
      date: paymentDate,
      amountPaid: amountInDebtUnit,
      paymentCurrency,
      originalAmount: amount,
      amountInPrimary: amountInBase,
      rateAtEntry,
      notes: paymentNotes || undefined,
    })

    const pmId = paymentMethodId || paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''
    addExpense({
      date: paymentDate,
      description: `Debt payment – ${selectedDebt.person}`,
      category: 'Debt',
      amount,
      currency: paymentCurrency as import('@/lib/store/types').Currency,
      paymentMethodId: pmId,
      isRecurring: false,
      notes: paymentNotes || undefined,
    })

    resetForm()
    closeSheet()
  }

  const paymentPreview = () => {
    if (!paymentAmount || !selectedDebt) return null
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return null

    if (selectedDebt.isGold && paymentCurrency !== 'XAU') {
      const gramsViaHelper = convertPaymentToDebtUnit(
        amount,
        paymentCurrency,
        selectedDebt,
        settings.baseCurrency,
        exchangeRates,
        goldPricePerGram
      )
      return `≈ ${gramsViaHelper.toFixed(2)}g of ${selectedDebt.goldKarat || 24}K gold`
    }

    if (!selectedDebt.isGold && paymentCurrency !== selectedDebt.currency) {
      const converted = convertPaymentToDebtUnit(amount, paymentCurrency, selectedDebt, settings.baseCurrency, exchangeRates, goldPricePerGram)
      return `≈ ${formatCurrency(converted, selectedDebt.currency)}`
    }

    return null
  }

  return (
    <ModalShell open={isOpen} onBackdropClick={closeSheet}>
            <div className="p-6">
              <div className="w-10 h-1 bg-[var(--color-brand-border)] rounded-full mx-auto mb-4 lg:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {debtSheetPaymentOnly ? 'Record Payment' : mode === 'new' ? 'Add New Debt' : 'Record Payment'}
                </h3>
                <button
                  onClick={closeSheet}
                  className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
                </button>
              </div>

              {!debtSheetPaymentOnly && (
                <div className="flex gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'new'
                        ? 'bg-[var(--color-brand-red)] text-white'
                        : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
                    }`}
                  >
                    New Debt
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('payment')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'payment'
                        ? 'bg-[var(--color-brand-red)] text-white'
                        : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]'
                    }`}
                  >
                    Record Payment
                  </button>
                </div>
              )}

              {mode === 'new' && !debtSheetPaymentOnly ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Debt Name</Label>
                    <Input
                      placeholder="e.g. Mom's Debt"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Person</Label>
                    <Input
                      placeholder="Who do you owe?"
                      value={person}
                      onChange={(e) => setPerson(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Description (optional)</Label>
                    <Input
                      placeholder="e.g. Gold jewelry, Wedding loan..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white placeholder:text-[var(--color-brand-text-muted)]"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Gold Debt?</Label>
                    <Switch
                      checked={isGold}
                      onCheckedChange={(val) => {
                        setIsGold(val)
                        if (val) setCurrency('XAU')
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                        {isGold ? 'Amount (grams)' : 'Amount'}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={startingBalance}
                        onChange={(e) => setStartingBalance(e.target.value)}
                        className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                      />
                    </div>
                    {!isGold && (
                      <div>
                        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Currency</Label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as DebtCurrency)}
                          className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                        >
                          {DEBT_FIAT_CURRENCIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {isGold && (
                      <div>
                        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Karat</Label>
                        <select
                          value={goldKarat}
                          onChange={(e) => setGoldKarat(parseInt(e.target.value) as GoldKarat)}
                          className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                        >
                          <option value="24">24K (99.9%)</option>
                          <option value="22">22K (91.7%)</option>
                          <option value="21">21K (87.5%)</option>
                          <option value="18">18K (75%)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeSheet}
                      className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddDebt}
                      disabled={!name || !person || !startingBalance}
                      className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Add Debt →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Select Debt</Label>
                    <select
                      value={selectedDebtId}
                      onChange={(e) => setSelectedDebtId(e.target.value)}
                      className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                    >
                      {debts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.isGold ? `(${d.goldKarat}K Gold)` : `(${d.currency})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount Paid</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => {
                          setPaymentAmount(e.target.value)
                          setPaymentRateError('')
                        }}
                        className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[var(--color-brand-text-secondary)]">Payment Currency</Label>
                      <select
                        value={paymentCurrency}
                        onChange={(e) => {
                          setPaymentCurrency(e.target.value)
                          setPaymentRateError('')
                        }}
                        className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
                      >
                        {FIAT_CURRENCIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {selectedDebt?.isGold && (
                          <option value="XAU">Gold (grams)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {paymentRateError ? (
                    <p className="text-xs text-[var(--color-brand-red)] px-1">{paymentRateError}</p>
                  ) : null}

                  {paymentPreview() && (
                    <p className="text-xs text-[var(--color-brand-gold)] px-1">
                      {paymentPreview()}
                    </p>
                  )}

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

                  <div>
                    <Label className="text-xs text-[var(--color-brand-text-secondary)]">Notes (optional)</Label>
                    <Textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeSheet}
                      className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPayment}
                      disabled={!selectedDebtId || !paymentAmount}
                      className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      Record Payment →
                    </button>
                  </div>
                </div>
              )}
            </div>
    </ModalShell>
  )
}
