'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import type { IncomeSource } from '@/lib/store/types'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditIncomeForm } from '@/hooks/useEditIncomeForm'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useShallow } from 'zustand/react/shallow'
import { EditIncomeTypeSection } from '@/components/features/income/EditIncomeTypeSection'
import { EditIncomeRecurringBlock } from '@/components/features/income/EditIncomeRecurringBlock'
import { EditIncomeAmountCurrency } from '@/components/features/income/EditIncomeAmountCurrency'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { incomeMonthlyMultiplier } from '@/lib/utils/calculations'

const DATE_FIELD_CLASS = 'mt-1 h-11 rounded-xl'

export function EditIncomeForm({ source, onClose }: { source: IncomeSource; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const f = useEditIncomeForm(source, onClose)
  const t = useT()
  const { savingsAccounts, debts, paymentMethods, deleteIncomeSource } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      paymentMethods: s.paymentMethods,
      deleteIncomeSource: s.deleteIncomeSource,
    }))
  )

  const amtNum = parseFloat(f.amount)
  const showMonthlyEq =
    f.isRecurring && !Number.isNaN(amtNum) && amtNum > 0 && f.recurringFrequency !== 'monthly'
  const monthlyEq = showMonthlyEq ? amtNum * incomeMonthlyMultiplier(f.recurringFrequency) : 0
  const fmtNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

  const handleDelete = () => {
    if (!window.confirm(t.income.confirmDelete)) return
    deleteIncomeSource(source.id)
    onClose()
  }

  const linkedAcc =
    source.linkedSavingsAccountId != null
      ? savingsAccounts.find((a) => a.id === source.linkedSavingsAccountId)
      : undefined
  const linkedDebt =
    source.linkedDebtId != null ? debts.find((d) => d.id === source.linkedDebtId) : undefined

  return (
    <div className="p-5">
      <ModalSheetHeader title={t.editIncome.title} onClose={onClose} />

      <div className="space-y-4">
        <EditIncomeTypeSection
          t={t}
          source={source}
          sourceType={f.sourceType}
          setSourceType={f.setSourceType}
          typeLocked={f.typeLocked}
          linkedAcc={linkedAcc}
          linkedDebt={linkedDebt}
        />

        <EditIncomeAmountCurrency
          t={t}
          name={f.name}
          setName={f.setName}
          amount={f.amount}
          setAmount={f.setAmount}
          currency={f.currency}
          setCurrency={f.setCurrency}
        />
        {showMonthlyEq ? (
          <p className="-mt-2 font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
            {fmtNum(amtNum)} {f.currency}{' '}
            {t.income[f.recurringFrequency === 'weekly' ? 'freqWeeklyShort' : 'freqBiweeklyShort'].toLowerCase()}
            {' → ≈ '}
            <span className="font-semibold text-[var(--color-brand-green)]">
              {fmtNum(monthlyEq)} {f.currency}
            </span>{' '}
            {t.income.perMoSuffix}
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelRecurring}</Label>
          <Switch checked={f.isRecurring} onCheckedChange={f.setIsRecurring} disabled={f.typeLocked} />
        </div>
        {f.isRecurring && (
          <EditIncomeRecurringBlock
            t={t}
            recurringFrequency={f.recurringFrequency}
            setRecurringFrequency={f.setRecurringFrequency}
            dayOfMonth={f.dayOfMonth}
            setDayOfMonth={f.setDayOfMonth}
          />
        )}

        <PaymentMethodPicker
          value={f.paymentMethodId}
          onChange={f.setPaymentMethodId}
          paymentMethods={paymentMethods}
          label={t.addIncome.labelPaymentMethod}
        />

        {f.isRecurring && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.income.effectiveStart}</Label>
              <DatePickerField
                value={f.effectiveStart}
                onChange={f.setEffectiveStart}
                className={DATE_FIELD_CLASS}
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.income.effectiveEnd}</Label>
              <DatePickerField
                value={f.effectiveEnd}
                onChange={f.setEffectiveEnd}
                className={DATE_FIELD_CLASS}
              />
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelNotes}</Label>
          <Textarea
            value={f.notes}
            onChange={(e) => f.setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-16"
          />
        </div>
        <p className="text-[10px] text-[var(--color-brand-text-muted)]">
          {t.editIncome.budgetNote(f.baseCurrency)}
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)]"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={f.handleSubmit}
            disabled={!f.name || !f.amount}
            className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50"
          >
            {t.editIncome.buttonSave}
          </button>
        </div>
        {!source.sharedPlanId && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-2 py-3 text-sm text-[var(--color-brand-red)] opacity-80 hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
            {t.common.delete}
          </button>
        )}
      </div>
    </div>
  )
}
