'use client'

import { useEffect, useState } from 'react'
import { X, ChevronRight, Trash2, Plus, CircleCheck, Landmark, CreditCard, CalendarClock } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { DebtFamilyStep } from '@/components/features/debts/redesign/DebtFamilyStep'
import { AddBorrowForm } from '@/components/features/debts/redesign/AddBorrowForm'
import { AddInstallmentForm } from '@/components/features/debts/redesign/AddInstallmentForm'
import { PayDebtForm } from '@/components/features/debts/redesign/PayDebtForm'
import { useT } from '@/lib/i18n'
import { useModalTitleId } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { debtFamily, type DebtFamily } from '@/lib/debts/debtFamily'
import { shortDate } from '@/lib/utils/shortDate'
import { formatWhole } from '@/lib/utils/formatters'

/** Loads debts only while the sheet is open, so the always-mounted sheet adds no startup queries. */
function HydrateDebtsWhileOpen() {
  return null
}

/**
 * Debt bottom sheet (handoff §4). New: family picker → per-family form. Edit: the
 * same per-type form, prefilled, with locked fields + borderless delete. Also the
 * pay-debt flow (select → form). Credit-card add/edit is delegated to the unified
 * payment-method sheet (AddCreditCardSheet). Logic in `useAddDebtSheet`.
 */
export function AddDebtSheet() {
  const d = useAddDebtSheet()
  const t = useT()
  // Credit-card add & edit are handled by the payment-method sheet, not here.
  const isCardEdit = d.isEditFlow && d.editingDebt?.debtType === 'credit_card'
  const open = d.isOpen && !isCardEdit
  useEscapeClose(open, d.closeSheet)

  const presetFamily = useSettingsStore((s) => s.debtSheetPresetFamily)
  const [familyStep, setFamilyStep] = useState<'pick' | 'form'>('pick')
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset/preset step when the sheet toggles */
    if (!d.isOpen) { setFamilyStep('pick'); return }
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
  const title = isPayUI
    ? payShowsForm ? 'Make a payment' : tp.title
    : d.isEditFlow
      ? d.debtType === 'installment' ? 'Edit installment' : 'Edit borrow'
      : familyStep === 'pick'
        ? 'Add debt'
        : d.debtType === 'installment' ? 'New installment' : 'New borrow'

  const payAmt = parseFloat(d.paymentAmount)
  const canSubmit = isPayUI
    ? !!(d.selectedDebtId && d.paymentAmount && payAmt > 0)
    : d.canSubmitNewDebt
  const cta = isPayUI
    ? d.paymentScheduleMode === 'recurring'
      ? 'Schedule payment'
      : `Pay ${!Number.isNaN(payAmt) && payAmt > 0 ? formatWhole(payAmt) : ''} ${d.paymentCurrency}`.replace(/\s+/g, ' ').trim()
    : d.isEditFlow ? 'Save changes' : d.debtType === 'installment' ? 'Add plan' : 'Add borrow'

  const onSubmit = isPayUI ? d.handleAddPayment : d.handleAddDebt

  const pickFamily = (k: 'personal' | 'credit_card' | 'installment') => {
    d.setDebtType(k) // 'credit_card' redirects to the unified sheet + closes
    if (k !== 'credit_card') setFamilyStep('form')
  }

  const payShowsSelect = d.isPayDebtFlow && d.payDebtStep === 'select'
  const showFooter = isFormUI || (isPayUI && !payShowsSelect)

  return (
    <ModalShell open={open} onBackdropClick={d.closeSheet} scrollChild>
      {open ? <HydrateDebtsWhileOpen /> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-3 pt-4">
          <span id={useModalTitleId()} className="min-w-0 flex-1 text-xl font-bold text-[var(--color-brand-text-primary)]">{title}</span>
          <IconButton
            aria-label={t.common.close}
            onClick={d.closeSheet}
            variant="tinted"
            size="sm"
            shape="round"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        {/* Body */}
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {isPayUI ? (
            payShowsSelect ? (
              d.payableRows.length === 0 ? (
                <EmptyState
                  icon={
                    <span className="inline-flex size-14 items-center justify-center rounded-[18px] bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                      <CircleCheck className="size-8" aria-hidden />
                    </span>
                  }
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
                  <p className="pb-1 text-[13px] text-[var(--color-brand-text-secondary)]">{tp.subtitle}</p>
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
                          <span className="block truncate text-[15px] font-bold text-[var(--color-brand-text-primary)]">{pd.name || pd.person}</span>
                          <span className="block truncate text-[12px] text-[var(--color-brand-text-secondary)]">
                            {label}{due ? ` · ${tp.dueOn(shortDate(due))}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-end">
                          <span className="block font-mono-numbers text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{formatWhole(remaining)}</span>
                          <span className="block text-[11px] text-[var(--color-brand-text-secondary)]">{pd.currency} {fam === 'credit_card' ? tp.owed : tp.left}</span>
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
          <div className="sheet-cta flex shrink-0 items-center gap-3 border-t border-[var(--color-brand-border)] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            {d.isEditFlow ? (
              <Button variant="destructive" size="touch" onClick={d.handleDeleteDebt}>
                <Trash2 className="h-4 w-4" />
                {t.common.delete}
              </Button>
            ) : null}
            <Button size="cta" onClick={onSubmit} disabled={!canSubmit} className="flex-1 text-base font-bold">
              {cta}
            </Button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}
