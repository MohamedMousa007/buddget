'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import type {
  Currency,
  DebtGoal,
  DebtKind,
  DebtReceivedVia,
  GoldKarat,
  IncomeRecurringFrequency,
  IncomeSourceType,
  InstallmentProvider,
} from '@/lib/store/types'
import { AddIncomeFormFields } from '@/components/modals/AddIncomeFormFields'
import { IncomeDebtEmbed } from '@/components/features/income/IncomeDebtEmbed'
import { DebtGoalSheet } from '@/components/features/debts/DebtGoalSheet'
import { buildDebtFromIncomeFlow } from '@/lib/debt/buildDebtFromIncomeFlow'
import { useDraftEntry } from '@/lib/onboarding/draftEntry'

interface IncomeDraftShape {
  name: string
  amount: string
  currency: Currency
  paymentMethodId: string
  sourceType: IncomeSourceType
  isRecurring: boolean
  recurringFrequency: IncomeRecurringFrequency
  dayOfMonth: string
  notes: string
}

function canSubmitIncomeDebt(
  name: string,
  amount: number,
  debtType: DebtKind,
  person: string,
  installmentItemName: string,
  installmentCount: string,
  installmentStartDate: string,
  creditor: string,
  installmentProvider: InstallmentProvider,
  linkedCreditCardDebtId: string
): boolean {
  if (!name.trim() || amount <= 0) return false
  if (debtType === 'personal') return !!person.trim()
  if (debtType === 'installment') {
    const n = parseInt(installmentCount, 10)
    const baseOk = !!(installmentItemName.trim() && !Number.isNaN(n) && n > 0 && installmentStartDate)
    if (!baseOk) return false
    if (installmentProvider === 'credit_card' && !linkedCreditCardDebtId.trim()) return false
    return true
  }
  return !!(name.trim() && (person.trim() || creditor.trim()))
}

export function AddIncomeSheet() {
  const showToast = useActionToast()
  const { addIncomeSource, addIncomeWithDebt, settings, paymentMethods, debts } = useFinanceStore(
    useShallow((s) => ({
      addIncomeSource: s.addIncomeSource,
      addIncomeWithDebt: s.addIncomeWithDebt,
      settings: s.settings,
      paymentMethods: s.paymentMethods,
      debts: s.debts,
    }))
  )
  const { activeModal, setActiveModal } = useSettingsStore()
  const t = useT()
  const isOpen = activeModal === 'addIncome'

  // Journey-mode draft resume: no-op outside /onboarding. On first
  // mount inside the Journey, seed from any half-filled draft so a
  // mid-modal tab close doesn't lose typed values. Only covers core
  // income fields; the debt-embed branch resets to defaults.
  const draft = useDraftEntry<IncomeDraftShape>('incomeSources')

  const [name, setName] = useState(draft.initial?.name ?? '')
  const [amount, setAmount] = useState(draft.initial?.amount ?? '')
  const [currency, setCurrency] = useState<Currency>(
    draft.initial?.currency ?? settings.baseCurrency,
  )
  const [paymentMethodId, setPaymentMethodId] = useState(
    () =>
      draft.initial?.paymentMethodId ||
      paymentMethods.find((m) => m.isDefault)?.id ||
      paymentMethods[0]?.id ||
      '',
  )
  const [sourceType, setSourceType] = useState<IncomeSourceType>(
    draft.initial?.sourceType ?? 'salary',
  )
  const [isRecurring, setIsRecurring] = useState(draft.initial?.isRecurring ?? true)
  const [recurringFrequency, setRecurringFrequency] = useState<IncomeRecurringFrequency>(
    draft.initial?.recurringFrequency ?? 'monthly',
  )
  const [dayOfMonth, setDayOfMonth] = useState(draft.initial?.dayOfMonth ?? '1')
  const [notes, setNotes] = useState(draft.initial?.notes ?? '')

  const [debtType, setDebtType] = useState<DebtKind>('personal')
  const [debtPerson, setDebtPerson] = useState('')
  const [debtDescription, setDebtDescription] = useState('')
  const [relationship, setRelationship] = useState('')
  const [debtDirection] = useState<'i_owe' | 'they_owe'>('i_owe')
  const [creditor, setCreditor] = useState('')
  const [installmentItemName, setInstallmentItemName] = useState('')
  const [installmentCount, setInstallmentCount] = useState('12')
  const [installmentFrequency, setInstallmentFrequency] = useState<
    'weekly' | 'monthly' | 'quarterly' | 'annually'
  >('monthly')
  const [installmentStartDate, setInstallmentStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [interestFree, setInterestFree] = useState(true)
  const [debtReceivedVia, setDebtReceivedVia] = useState<DebtReceivedVia>('cash')
  const [goldKarat, setGoldKarat] = useState<GoldKarat>(24)
  const [goalDraft, setGoalDraft] = useState<DebtGoal | null>(null)
  const [goalSheetOpen, setGoalSheetOpen] = useState(false)
  const [installmentProvider, setInstallmentProvider] = useState<InstallmentProvider>('other')
  const [linkedCreditCardDebtId, setLinkedCreditCardDebtId] = useState('')

  const prevIsOpen = useRef(false)

  const creditCardDebts = useMemo(
    () => debts.filter((d) => d.debtType === 'credit_card').map((d) => ({ id: d.id, name: d.name })),
    [debts]
  )

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- BNPL defaults when switching provider */
    if (installmentProvider === 'tabby' || installmentProvider === 'tamara') {
      setInstallmentCount('4')
      setInstallmentFrequency('monthly')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [installmentProvider])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- default linked card when list loads */
    if (debtType !== 'installment' || installmentProvider !== 'credit_card') return
    if (creditCardDebts.length === 0) return
    if (!linkedCreditCardDebtId || !creditCardDebts.some((d) => d.id === linkedCreditCardDebtId)) {
      setLinkedCreditCardDebtId(creditCardDebts[0].id)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [debtType, installmentProvider, creditCardDebts, linkedCreditCardDebtId])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync default currency when sheet opens */
    if (isOpen && !prevIsOpen.current) {
      // Don't clobber resumed draft values when the user re-opens the
      // modal mid-journey.
      if (!draft.active || !draft.initial?.currency) {
        setCurrency(settings.baseCurrency)
      }
      if (!draft.active || !draft.initial?.paymentMethodId) {
        setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
      }
    }
    prevIsOpen.current = isOpen
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, settings.baseCurrency, paymentMethods, draft.active, draft.initial])

  // Keep the persisted draft in sync with live form edits (debounced).
  useEffect(() => {
    if (!isOpen || !draft.active) return
    draft.update({
      name,
      amount,
      currency,
      paymentMethodId,
      sourceType,
      isRecurring,
      recurringFrequency,
      dayOfMonth,
      notes,
    })
  }, [
    isOpen,
    draft,
    name,
    amount,
    currency,
    paymentMethodId,
    sourceType,
    isRecurring,
    recurringFrequency,
    dayOfMonth,
    notes,
  ])

  const resetDebtFields = useCallback(() => {
    setDebtType('personal')
    setDebtPerson('')
    setDebtDescription('')
    setRelationship('')
    setCreditor('')
    setInstallmentItemName('')
    setInstallmentCount('12')
    setInstallmentFrequency('monthly')
    setInstallmentStartDate(new Date().toISOString().slice(0, 10))
    setInterestFree(true)
    setDebtReceivedVia('cash')
    setGoldKarat(24)
    setGoalDraft(null)
    setGoalSheetOpen(false)
    setInstallmentProvider('other')
    setLinkedCreditCardDebtId('')
  }, [])

  const resetForm = useCallback(() => {
    setName('')
    setAmount('')
    setCurrency(settings.baseCurrency)
    setPaymentMethodId(paymentMethods.find((m) => m.isDefault)?.id || paymentMethods[0]?.id || '')
    setSourceType('salary')
    setIsRecurring(true)
    setRecurringFrequency('monthly')
    setDayOfMonth('1')
    setNotes('')
    resetDebtFields()
  }, [paymentMethods, resetDebtFields, settings.baseCurrency])

  const applyIncomeDebtReceivedVia = useCallback(
    (rv: DebtReceivedVia) => {
      setDebtReceivedVia(rv)
      if (rv === 'gold') setCurrency('XAU')
      else setCurrency(settings.baseCurrency)
    },
    [settings.baseCurrency]
  )

  const onSourceTypeChange = useCallback(
    (st: IncomeSourceType) => {
      setSourceType(st)
      if (st === 'salary') {
        setIsRecurring(true)
        setRecurringFrequency('monthly')
      } else if (st === 'debt' || st === 'gift' || st === 'refund') {
        setIsRecurring(false)
      } else {
        setIsRecurring(false)
      }
      if (st !== 'debt') resetDebtFields()
    },
    [resetDebtFields]
  )

  const installmentPreview = useMemo(() => {
    const total = parseFloat(amount)
    const n = parseInt(installmentCount, 10)
    if (!amount || Number.isNaN(total) || Number.isNaN(n) || n <= 0) return null
    return interestFree ? total / n : total / n
  }, [amount, installmentCount, interestFree])

  const handleSubmit = () => {
    if (!name || !amount || parseFloat(amount) <= 0) return
    const cur = clampFiatToAllowed(settings, currency)
    const amt = parseFloat(amount)
    const pm = paymentMethodId || paymentMethods[0]?.id

    if (sourceType === 'debt') {
      if (
        !canSubmitIncomeDebt(
          name,
          amt,
          debtType,
          debtPerson,
          installmentItemName,
          installmentCount,
          installmentStartDate,
          creditor,
          installmentProvider,
          linkedCreditCardDebtId
        )
      ) {
        return
      }
      const debtRow = buildDebtFromIncomeFlow(settings, {
        incomeName: name.trim(),
        incomeAmount: amt,
        incomeCurrency: cur,
        debtType,
        personStr: debtPerson.trim(),
        description: debtDescription,
        relationship,
        creditor,
        installmentItemName,
        installmentCount,
        installmentFrequency,
        installmentStartDate,
        interestFree,
        receivedVia: debtReceivedVia,
        goldKarat,
        goal: goalDraft,
        installmentProvider,
        linkedCreditCardDebtId:
          installmentProvider === 'credit_card' ? linkedCreditCardDebtId : undefined,
      })
      addIncomeWithDebt(
        {
          name,
          amount: amt,
          currency: cur,
          isRecurring: false,
          recurringFrequency: undefined,
          dayOfMonth: undefined,
          notes: notes || undefined,
          paymentMethodId: pm,
        },
        debtRow
      )
    } else {
      addIncomeSource({
        name,
        amount: amt,
        currency: cur,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        dayOfMonth: isRecurring && recurringFrequency === 'monthly' ? parseInt(dayOfMonth, 10) || 1 : undefined,
        notes: notes || undefined,
        sourceType,
        paymentMethodId: pm,
      })
    }

    showToast(t.common.toastIncomeAdded)
    draft.clear()
    resetForm()
    setActiveModal(null)
  }

  const handleClose = () => {
    // Inside the Journey, keep the draft so a plain-close resumes the
    // typed values. Outside onboarding, reset as before.
    if (!draft.active) resetForm()
    setActiveModal(null)
  }

  useEscapeClose(isOpen, handleClose)

  const debtOk =
    sourceType !== 'debt' ||
    canSubmitIncomeDebt(
      name,
      parseFloat(amount) || 0,
      debtType,
      debtPerson,
      installmentItemName,
      installmentCount,
      installmentStartDate,
      creditor,
      installmentProvider,
      linkedCreditCardDebtId
    )

  const goalTitle =
    debtType === 'installment' ? installmentItemName || t.addDebt.labelItemName : name || t.addDebt.labelName

  const debtSection =
    sourceType === 'debt' ? (
      <IncomeDebtEmbed
        incomeAmount={Math.max(0, parseFloat(amount) || 0)}
        incomeCurrency={currency as import('@/lib/store/types').DebtCurrency}
        debtType={debtType}
        setDebtType={setDebtType}
        person={debtPerson}
        setPerson={setDebtPerson}
        description={debtDescription}
        setDescription={setDebtDescription}
        relationship={relationship}
        setRelationship={setRelationship}
        direction={debtDirection}
        setDirection={() => {}}
        creditor={creditor}
        setCreditor={setCreditor}
        installmentItemName={installmentItemName}
        setInstallmentItemName={setInstallmentItemName}
        installmentCount={installmentCount}
        setInstallmentCount={setInstallmentCount}
        installmentFrequency={installmentFrequency}
        setInstallmentFrequency={setInstallmentFrequency}
        installmentStartDate={installmentStartDate}
        setInstallmentStartDate={setInstallmentStartDate}
        interestFree={interestFree}
        setInterestFree={setInterestFree}
        receivedVia={debtReceivedVia}
        onReceivedViaChange={applyIncomeDebtReceivedVia}
        goldKarat={goldKarat}
        setGoldKarat={setGoldKarat}
        installmentPreview={installmentPreview}
        goalDraft={goalDraft}
        onOpenGoal={() => setGoalSheetOpen(true)}
        onClearGoal={() => setGoalDraft(null)}
        installmentProvider={installmentProvider}
        setInstallmentProvider={setInstallmentProvider}
        linkedCreditCardDebtId={linkedCreditCardDebtId}
        setLinkedCreditCardDebtId={setLinkedCreditCardDebtId}
        creditCardDebts={creditCardDebts}
      />
    ) : null

  return (
    <>
      <ModalShell open={isOpen} onBackdropClick={handleClose}>
        <div className="p-5">
          <ModalSheetHeader title={t.addIncome.sheetTitle} onClose={handleClose} />

          <AddIncomeFormFields
            t={t}
            name={name}
            setName={setName}
            amount={amount}
            setAmount={setAmount}
            currency={currency}
            setCurrency={setCurrency}
            paymentMethods={paymentMethods}
            paymentMethodId={paymentMethodId}
            setPaymentMethodId={setPaymentMethodId}
            sourceType={sourceType}
            onSourceTypeChange={onSourceTypeChange}
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            recurringFrequency={recurringFrequency}
            setRecurringFrequency={setRecurringFrequency}
            dayOfMonth={dayOfMonth}
            setDayOfMonth={setDayOfMonth}
            notes={notes}
            setNotes={setNotes}
            debtSection={debtSection}
          />

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              data-tutorial-id="income-modal:save"
              onClick={handleSubmit}
              disabled={!name || !amount || !debtOk}
              className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.addIncome.buttonSubmit}
            </button>
          </div>
        </div>
      </ModalShell>

      <DebtGoalSheet
        open={goalSheetOpen}
        onClose={() => setGoalSheetOpen(false)}
        debtTitle={goalTitle}
        remainingAmount={Math.max(0, parseFloat(amount) || 0)}
        currency={String(currency)}
        initialGoal={goalDraft}
        onSave={(goal) => {
          setGoalDraft(goal)
        }}
      />
    </>
  )
}
