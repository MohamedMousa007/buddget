'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { incomeMonthlyMultiplier, suggestIncomeTemplate } from '@/lib/utils/calculations'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import type { Currency, IncomeRecurringFrequency, IncomeSourceType } from '@/lib/store/types'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { IncomeSourceTypePicker } from '@/components/features/income/IncomeSourceTypePicker'
import { EditIncomeRecurringBlock } from '@/components/features/income/EditIncomeRecurringBlock'
import { IncomeTemplatePicker } from '@/components/features/income/IncomeTemplatePicker'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import {
  MODAL_BODY_SCROLL_CLASS,
  MODAL_CONTROL_CLASS,
  MODAL_LABEL_CLASS,
} from '@/lib/modals/modalFormClasses'

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function AddIncomeSheet() {
  const showToast = useActionToast()
  const { addIncomeSource, addIncomeEvent, settings, paymentMethods, incomeSources } = useFinanceStore(
    useShallow((s) => ({
      addIncomeSource: s.addIncomeSource,
      addIncomeEvent: s.addIncomeEvent,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      incomeSources: s.incomeSources,
    }))
  )
  const recurringTemplates = useMemo(() => incomeSources.filter((s) => s.isRecurring), [incomeSources])
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addIncome'

  const defaultPmId = paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || ''

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency)
  const [isRecurring, setIsRecurring] = useState(true)
  const [sourceType, setSourceType] = useState<IncomeSourceType>('salary')
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [templateId, setTemplateId] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState(defaultPmId)
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)

  const prevIsOpen = useRef(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset defaults when the sheet opens */
    if (isOpen && !prevIsOpen.current) {
      setCurrency(settings.baseCurrency)
      setPaymentMethodId(defaultPmId)
      setReceivedDate(new Date().toISOString().slice(0, 10))
      setTemplateId('')
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, defaultPmId])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setIsRecurring(true)
    setSourceType('salary')
    setRecurringFrequency('monthly')
    setDayOfMonth('1')
    setReceivedDate(new Date().toISOString().slice(0, 10))
    setTemplateId('')
    setPaymentMethodId(defaultPmId)
    setNotes('')
    setNotesOpen(false)
  }, [settings.baseCurrency, defaultPmId])

  const amt = parseFloat(amount)
  const amtValid = !Number.isNaN(amt) && amt > 0
  const suggestedTemplate =
    !isRecurring && amtValid ? suggestIncomeTemplate(amt, clampFiatToAllowed(settings, currency), recurringTemplates) : null
  // Per-paycheck → per-month conversion so bi-weekly/weekly amounts aren't a surprise.
  const showMonthlyEq = isRecurring && amtValid && recurringFrequency !== 'monthly'
  const monthlyEq = amtValid ? amt * incomeMonthlyMultiplier(recurringFrequency) : 0

  const handleSubmit = () => {
    if (!name.trim() || !amtValid) return
    const cur = clampFiatToAllowed(settings, currency)
    if (isRecurring) {
      // Recurring income is a template that projects monthly.
      addIncomeSource({
        name: name.trim(),
        amount: amt,
        currency: cur,
        isRecurring: true,
        recurringFrequency,
        dayOfMonth: recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
        sourceType,
        notes: notes.trim() || undefined,
        ...(paymentMethodId ? { paymentMethodId } : {}),
      })
    } else {
      // One-time income is a confirmed event in the ledger.
      addIncomeEvent({
        name: name.trim(),
        amount: amt,
        currency: cur,
        sourceType,
        receivedDate,
        status: 'confirmed',
        notes: notes.trim() || undefined,
        ...(templateId ? { templateId } : {}),
        ...(paymentMethodId ? { paymentMethodId } : {}),
      })
    }

    showToast(t.common.toastIncomeAdded)
    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col outline-none">
        <div className="shrink-0 px-5 pt-1">
          <ModalSheetHeader title={t.addIncome.sheetTitle} onClose={handleClose} />
        </div>
        <div className={`${MODAL_BODY_SCROLL_CLASS} px-5`}>
          {/* name */}
          <div>
            <label htmlFor="income-name" className={MODAL_LABEL_CLASS}>
              {t.addIncome.labelSource}
            </label>
            <Input
              id="income-name"
              placeholder={t.addIncome.placeholderSource}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1.5 ${MODAL_CONTROL_CLASS}`}
            />
          </div>

          {/* amount + currency */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="min-w-0">
              <label htmlFor="income-amt" className={MODAL_LABEL_CLASS}>
                {t.addIncome.labelAmount}
              </label>
              <AmountField
                id="income-amt"
                placeholder={t.addIncome.placeholderAmount}
                value={amount}
                onChange={setAmount}
                className={`mt-1.5 ${MODAL_CONTROL_CLASS} text-xl font-semibold font-mono-numbers`}
              />
            </div>
            <div className="w-[7.5rem] shrink-0">
              <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelCurrency}</span>
              <FiatCurrencySelect
                value={currency}
                onChange={setCurrency}
                className="mt-1.5 w-full h-12 px-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] text-sm focus:border-[var(--color-brand-red)]"
              />
            </div>
          </div>
          {showMonthlyEq ? (
            <p className="-mt-2 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
              {fmtNum(amt)} {currency} {t.income[recurringFrequency === 'weekly' ? 'freqWeeklyShort' : 'freqBiweeklyShort'].toLowerCase()}
              {' → ≈ '}
              <span className="font-semibold text-[var(--color-brand-green)]">{fmtNum(monthlyEq)} {currency}</span> {t.income.perMoSuffix}
            </p>
          ) : null}

          {/* source type */}
          <div>
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelSourceType}</span>
            <div className="mt-1.5">
              <IncomeSourceTypePicker value={sourceType} onChange={setSourceType} labels={t.income} mode="manual" />
            </div>
          </div>

          {/* recurring toggle */}
          <div className="flex items-center justify-between gap-3 py-1">
            <span className={MODAL_LABEL_CLASS}>{t.addIncome.labelRecurring}</span>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {/* frequency + day-of-month */}
          {isRecurring ? (
            <EditIncomeRecurringBlock
              t={t}
              recurringFrequency={recurringFrequency}
              setRecurringFrequency={setRecurringFrequency}
              dayOfMonth={dayOfMonth}
              setDayOfMonth={setDayOfMonth}
            />
          ) : (
            <div>
              <span className={MODAL_LABEL_CLASS}>{t.income.receivedDate}</span>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="mt-1.5 w-full h-12 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)] focus:border-[var(--color-brand-red)] focus:outline-none"
              />
            </div>
          )}

          {/* link one-time income to a recurring template (optional) */}
          {!isRecurring ? (
            <IncomeTemplatePicker
              value={templateId}
              onChange={setTemplateId}
              templates={recurringTemplates}
              label={t.income.linkToRecurring}
              noneLabel={t.income.notLinkedToRecurring}
              suggestion={suggestedTemplate ? { id: suggestedTemplate.id, name: suggestedTemplate.name } : null}
              suggestionLabel={t.income.looksLikeTemplate}
            />
          ) : null}

          {/* payment method */}
          <PaymentMethodPicker
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            paymentMethods={paymentMethods}
            label={t.addIncome.labelPaymentMethod}
          />

          {/* notes (progressive disclosure) */}
          {notesOpen ? (
            <div>
              <label htmlFor="income-notes" className={MODAL_LABEL_CLASS}>
                {t.addIncome.labelNotes}
              </label>
              <Textarea
                id="income-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.addIncome.placeholderNotes}
                className="mt-1.5 min-h-16 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="inline-flex items-center gap-1 self-start text-sm font-semibold text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]"
            >
              <ChevronDown className="h-4 w-4" />
              {t.addIncome.labelNotes}
            </button>
          )}
        </div>

        <div className="shrink-0 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !amtValid}
            className="w-full py-3.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.addIncome.buttonSubmit}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
