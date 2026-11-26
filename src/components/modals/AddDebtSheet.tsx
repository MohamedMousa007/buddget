'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Trash2, Plus, CircleCheck, Landmark, CreditCard, CalendarClock } from 'lucide-react'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { ModalShell, useDismissGuard } from '@/components/modals/ModalShell'
import { UnsavedChangesDialog } from '@/components/features/expenses/UnsavedChangesDialog'
import { DebtFamilyStep } from '@/components/features/debts/redesign/DebtFamilyStep'
import { AddBorrowForm } from '@/components/features/debts/redesign/AddBorrowForm'
import { AddInstallmentForm } from '@/components/features/debts/redesign/AddInstallmentForm'
import { PayDebtForm } from '@/components/features/debts/redesign/PayDebtForm'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { HEADER_PILL } from '@/components/ui/PillButton'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { debtFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import { useShortDate } from '@/hooks/useShortDate'
import { formatWhole } from '@/lib/utils/formatters'

/** Loads debts only while the sheet is open, so the always-mounted sheet adds no startup queries. */
function HydrateDebtsWhileOpen() {
  return null
}

/** Inside ModalShell: a backdrop tap, swipe down, Escape or Android back with typed data asks first. */
function DraftDismissGuard({ dirty, asking, setAsking }: { dirty: boolean; asking: boolean; setAsking: (v: boolean) => void }) {
  useDismissGuard(() => {
    if (asking) { setAsking(false); return true }
    if (dirty) { setAsking(true); return true }
    return false
  })
  return null
}

/**
 * Debt bottom sheet (handoff §4). New: family picker → per-family form. Edit: the
 * same per-type form, prefilled, with locked fields + borderless delete. Also the
 * pay-debt flow (select → form). Credit-card add/edit is delegated to the unified
 * payment-method sheet (AddCreditCardSheet). Logic in `useAddDebtSheet`.
 */
export function AddDebtSheet() {
  const shortDate = useShortDate()
  const d = useAddDebtSheet()
  const timeLabel = useFlowLtCopy().expense.time
  const t = useT()
  const lt = useDebtsSubsLtCopy()
  const confirm = useConfirm()
  // Credit-card add & edit are handled by the payment-method sheet, not here.
  const isCardEdit = d.isEditFlow && d.editingDebt?.debtType === 'credit_card'
  const open = d.isOpen && !isCardEdit
  const [asking, setAsking] = useState(false)
  const requestClose = () => (d.hasUnsavedDraft ? setAsking(true) : d.closeSheet())

  const presetFamily = useSettingsStore((s) => s.debtSheetPresetFamily)
  const [familyStep, setFamilyStep] = useState<'pick' | 'form'>('pick')
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset/preset step when the sheet toggles */
    if (!d.isOpen) { setFamilyStep('pick'); setAsking(false); return }
    // A preset (e.g. the Installments empty-state CTA) jumps straight to that form.
    if (presetFamily) { d.setDebtType(presetFamily); setFamilyStep('form') }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [d.isOpen, presetFamily]) // eslint-disable-line react-hooks/exhaustive-deps

  const recurring = useFinanceStore((s) => s.recurringDebtPayments)
  const tp = t.debtPicker
  const FAMILY_ROW: Record<DebtFamily, { Icon: typeof Landmark; color: string; label: string }> = {
    borrow: { Icon: Landmark, color: 'var(--color-cat-2)', label: tp.familyBorrow },
    credit_card: { Icon: CreditCard, color: 'var(--color-cat-4)', label: tp.familyCard },
    installment: { Icon: CalendarClock, color: 'var(--color-cat-1)', label: tp.familyInstallment },
  }
  const isPayUI = d.isPayDebtFlow || d.debtSheetPaymentOnly
  const isFormUI = d.isEditFlow || (!isPayUI && familyStep === 'form')

  const payShowsForm = isPayUI && !(d.isPayDebtFlow && d.payDebtStep === 'select')
  // Money owed to you comes in: the sheet records a receipt, never a payment out (BUD-90).
  const receiving = d.selectedDebt ? isOwedToUser(d.selectedDebt) : false
  const title = isPayUI
    ? payShowsForm ? (receiving ? t.debts.fReceiveTitle : t.debts.fPayTitle) : tp.title
    : d.isEditFlow
      ? d.debtType === 'installment' ? lt.install.editTitle : lt.borrow.editTitle
      : familyStep === 'pick'
        ? lt.debts.addTitle
        : d.debtType === 'installment' ? lt.install.newTitle : lt.borrow.newTitle

  const payAmt = parseFloat(d.paymentAmount)
  const canSubmit = isPayUI
    ? !!(d.selectedDebtId && d.paymentAmount && payAmt > 0)
    : d.canSubmitNewDebt
  const cta = isPayUI
    ? d.paymentScheduleMode === 'recurring'
      ? receiving ? t.debts.fScheduleReceive : t.debts.fSchedulePay
      : receiving ? lt.pay.markRepaid : lt.pay.record
    : d.isEditFlow ? lt.borrow.save : d.debtType === 'installment' ? lt.install.cta : lt.borrow.cta

  const onSubmit = isPayUI ? d.handleAddPayment : d.handleAddDebt
  // A new borrow or plan says what it still needs, once something was typed.
  const missingCopy = { amount: lt.borrow.needAmount, person: lt.borrow.needPerson, item: lt.borrow.needItem } as const
  const missing = isFormUI && !d.isEditFlow && d.hasUnsavedDraft && d.newDebtMissing ? missingCopy[d.newDebtMissing] : null

  const pickFamily = (k: 'personal' | 'credit_card' | 'installment') => {
    d.setDebtType(k) // 'credit_card' redirects to the unified sheet + closes
    if (k !== 'credit_card') setFamilyStep('form')
  }

  const payShowsSelect = d.isPayDebtFlow && d.payDebtStep === 'select'
  const showFooter = isFormUI || (isPayUI && !payShowsSelect)

  return (
    <ModalShell open={open} onBackdropClick={d.closeSheet} scrollChild>
      {open ? <HydrateDebtsWhileOpen /> : null}
      {open ? <DraftDismissGuard dirty={d.hasUnsavedDraft} asking={asking} setAsking={setAsking} /> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <V3SheetHeader
          onClose={requestClose}
          leading={payShowsForm ? <DatePickerField look="pill" className={HEADER_PILL} value={d.paymentDate} onChange={d.setPaymentDate} time={{ value: d.paymentTime, onChange: d.setPaymentTime, label: timeLabel, defaultNow: true }} /> : undefined}
          actions={d.isEditFlow ? (
            <V3SheetHeader.Action
              tone="danger"
              icon={<Trash2 />}
              label={t.common.delete}
              onClick={() => {
                const name = d.editingDebt?.name || d.editingDebt?.person || ''
                void confirm({ title: lt.debts.deleteTitle(name), body: lt.debts.deleteBody, confirmLabel: t.common.delete, destructive: true }).then((ok) => { if (ok) d.handleDeleteDebt() })
              }}
            />
          ) : undefined}
        >
          {payShowsForm ? (
            <span className="sr-only"><V3SheetHeader.Title>{title}</V3SheetHeader.Title></span>
          ) : (
            <V3SheetHeader.Title size="compact">{title}</V3SheetHeader.Title>
          )}
        </V3SheetHeader>

        {/* Body */}
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {isPayUI ? (
            payShowsSelect ? (
              d.payableRows.length === 0 ? (
                <EmptyState
                  icon={<CircleCheck />}
                  iconTone="positive"
                  title={tp.emptyTitle}
                  description={tp.emptyBody}
                  action={
                    <Button size="cta" className="w-full" onClick={() => useSettingsStore.getState().openDebtSheetNew()}>
                      <Plus /> {tp.emptyCta}
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="pb-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{tp.subtitle}</p>
                  {d.payableRows.map(({ debt: pd, remaining }) => {
                    const fam = debtFamily(pd)
                    const { Icon, color, label } = FAMILY_ROW[fam]
                    const due = recurring.find((r) => r.debtId === pd.id && r.isActive)?.nextDueDate
                    return (
                      <SelectableCard key={pd.id} as="action" onClick={() => d.selectDebtForPayFlow(pd.id)}>
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
                        >
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{pd.name || pd.person}</span>
                          <span className="block truncate text-[0.75rem] text-[var(--color-brand-text-secondary)]">
                            {label}{due ? ` · ${tp.dueOn(shortDate(due))}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block font-mono-numbers text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{formatWhole(remaining)}</span>
                          <span className="block text-[0.6875rem] text-[var(--color-brand-text-secondary)]">{pd.currency} {fam === 'credit_card' ? tp.owed : tp.left}</span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" />
                      </SelectableCard>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="touch"
                    className="mt-1 w-full border-dashed"
                    onClick={() => useSettingsStore.getState().openDebtSheetNew()}
                  >
                    <Plus /> {tp.addNew}
                  </Button>
                </div>
              )
            ) : (
              <PayDebtForm d={d} />
            )
          ) : isFormUI ? (
            d.debtType === 'installment' ? (
              <AddInstallmentForm d={d} locked={d.isEditFlow} />
            ) : (
              <AddBorrowForm d={d} locked={d.isEditFlow} />
            )
          ) : (
            <DebtFamilyStep onPick={pickFamily} />
          )}
        </div>

        {/* Footer */}
        {showFooter ? (
          <div className="sheet-cta flex shrink-0 flex-col gap-2 border-t border-[var(--color-brand-border)] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            {missing ? <p role="status" className="text-center text-xs text-[var(--color-brand-text-secondary)]">{missing}</p> : null}
            <Button size="cta" onClick={onSubmit} disabled={!canSubmit} className="w-full text-base font-bold">
              {cta}
            </Button>
          </div>
        ) : null}
      </div>
      <UnsavedChangesDialog
        open={open && asking}
        title={d.isEditFlow ? undefined : lt.borrow.draftTitle}
        body={lt.borrow.draftBody}
        saveLabel={cta}
        discardLabel={lt.borrow.draftDiscard}
        onSave={canSubmit ? () => { setAsking(false); onSubmit() } : undefined}
        onDiscard={() => {
          setAsking(false)
          d.closeSheet()
        }}
        onKeep={() => setAsking(false)}
      />
    </ModalShell>
  )
}
