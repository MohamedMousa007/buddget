'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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

export function EditIncomeForm({ source, onClose }: { source: IncomeSource; onClose: () => void }) {
  useEscapeClose(true, onClose)
  const f = useEditIncomeForm(source, onClose)
  const t = useT()
  const { savingsAccounts, debts } = useFinanceStore(
    useShallow((s) => ({ savingsAccounts: s.savingsAccounts, debts: s.debts }))
  )

  const linkedAcc =
    source.linkedSavingsAccountId != null
      ? savingsAccounts.find((a) => a.id === source.linkedSavingsAccountId)
      : undefined
  const linkedDebt =
    source.linkedDebtId != null ? debts.find((d) => d.id === source.linkedDebtId) : undefined

  return (
    <div className="p-6">
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
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.editIncome.labelNotes}</Label>
          <Textarea
            value={f.notes}
            onChange={(e) => f.setNotes(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-[60px]"
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
      </div>
    </div>
  )
}
