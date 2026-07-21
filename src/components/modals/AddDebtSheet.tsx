'use client'

import { useEffect, useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { DebtFamilyStep } from '@/components/features/debts/redesign/DebtFamilyStep'
import { AddBorrowForm } from '@/components/features/debts/redesign/AddBorrowForm'
import { AddInstallmentForm } from '@/components/features/debts/redesign/AddInstallmentForm'
import { PayDebtForm } from '@/components/features/debts/redesign/PayDebtForm'
import { fmtWhole } from '@/components/features/debts/redesign/heroCardShared'

/**
 * Debt bottom sheet (handoff §4). New: family picker → per-family form. Also the
 * pay-debt flow (select → form) and record-payment. Logic in `useAddDebtSheet`.
 */
export function AddDebtSheet() {
  const d = useAddDebtSheet()
  useEscapeClose(d.isOpen, d.closeSheet)

  // Step 1 (family picker) vs step 2 (form) for the new-debt flow.
  const [familyStep, setFamilyStep] = useState<'pick' | 'form'>('pick')
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset to step 1 when the sheet closes */
    if (!d.isOpen) setFamilyStep('pick')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [d.isOpen])

  const isPayUI = d.isPayDebtFlow || d.debtSheetPaymentOnly
  const isNewForm = !isPayUI && familyStep === 'form'

  const title = isPayUI
    ? 'Pay debt'
    : familyStep === 'pick'
      ? 'Add debt'
      : d.debtType === 'installment'
        ? 'New installment'
        : 'New borrow'

  const canSubmit = isPayUI
    ? !!(d.selectedDebtId && d.paymentAmount && parseFloat(d.paymentAmount) > 0)
    : d.canSubmitNewDebt
  const cta = isPayUI
    ? d.paymentScheduleMode === 'recurring' ? 'Schedule payment' : 'Confirm payment'
    : d.debtType === 'installment' ? 'Add plan' : 'Add borrow'

  const onSubmit = isPayUI ? d.handleAddPayment : d.handleAddDebt

  const pickFamily = (k: 'personal' | 'credit_card' | 'installment') => {
    d.setDebtType(k) // 'credit_card' redirects to the unified sheet + closes
    if (k !== 'credit_card') setFamilyStep('form')
  }

  // Pay flow: still on the select step (choose which debt)?
  const payShowsSelect = d.isPayDebtFlow && d.payDebtStep === 'select'
  const showFooter = isNewForm || (isPayUI && !payShowsSelect)

  return (
    <ModalShell open={d.isOpen} onBackdropClick={d.closeSheet} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-3 pt-4">
          <span className="min-w-0 flex-1 text-xl font-bold text-[var(--color-brand-text-primary)]">{title}</span>
          {isNewForm && d.debtType === 'installment' ? (
            <span className="rounded-full bg-[var(--color-brand-elevated)] px-3 py-1.5 font-mono-numbers text-[12px] font-semibold text-[var(--color-brand-text-secondary)]">
              {d.installmentStartDate}
            </span>
          ) : null}
          <button type="button" aria-label="Close" onClick={d.closeSheet} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {isPayUI ? (
            payShowsSelect ? (
              <div className="flex flex-col gap-2 pt-1">
                {d.payableDebts.map((pd) => (
                  <button key={pd.id} type="button" onClick={() => d.selectDebtForPayFlow(pd.id)} className="flex items-center gap-3 rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4 text-start">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-[var(--color-brand-text-primary)]">{pd.name || pd.person}</span>
                      <span className="block font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">{fmtWhole(pd.startingBalance)} {pd.currency}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-brand-text-muted)]" />
                  </button>
                ))}
                {d.payableDebts.length === 0 ? <p className="py-10 text-center text-sm text-[var(--color-brand-text-muted)]">No debts to pay right now.</p> : null}
              </div>
            ) : (
              <PayDebtForm d={d} />
            )
          ) : familyStep === 'pick' ? (
            <DebtFamilyStep onPick={pickFamily} />
          ) : d.debtType === 'installment' ? (
            <AddInstallmentForm d={d} />
          ) : (
            <AddBorrowForm d={d} />
          )}
        </div>

        {/* Footer CTA */}
        {showFooter ? (
          <div className="shrink-0 border-t border-[var(--color-brand-border)] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="h-[52px] w-full rounded-[14px] bg-[var(--color-brand-red)] text-base font-bold text-white transition-colors hover:bg-[var(--color-brand-red-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cta}
            </button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}
