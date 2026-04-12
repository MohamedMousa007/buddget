'use client'

import { useMemo, useState, useEffect } from 'react'
import { endOfMonth, format, parseISO } from 'date-fns'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calculateGoalPayment } from '@/lib/debts/calculateGoalPayment'
import type { Currency, DebtGoal } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { useT } from '@/lib/i18n'

interface DebtGoalSheetProps {
  open: boolean
  onClose: () => void
  debtTitle: string
  remainingAmount: number
  currency: string
  initialGoal?: DebtGoal | null
  /** When editing, reflect whether a recurring row already exists for this debt. */
  initialRemindRecurring?: boolean
  onSave: (goal: DebtGoal, remindRecurring: boolean) => void
}

type GoalFreq = DebtGoal['paymentFrequency']

/**
 * Nested sheet: optional payoff goal (target month + payment cadence).
 */
export function DebtGoalSheet({
  open,
  onClose,
  debtTitle,
  remainingAmount,
  currency,
  initialGoal,
  initialRemindRecurring = false,
  onSave,
}: DebtGoalSheetProps) {
  const t = useT()
  const { incomeSources, settings, exchangeRates } = useFinanceStore()
  const [monthValue, setMonthValue] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM'))
  const [frequency, setFrequency] = useState<GoalFreq>('monthly')
  const [remind, setRemind] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate nested sheet when opened with existing goal / remind */
    if (initialGoal?.targetDate) {
      const d = parseISO(initialGoal.targetDate + 'T12:00:00')
      setMonthValue(format(d, 'yyyy-MM'))
      setFrequency(initialGoal.paymentFrequency)
    }
    setRemind(initialRemindRecurring)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialGoal, initialRemindRecurring])

  const targetDateIso = useMemo(() => {
    const d = endOfMonth(parseISO(monthValue + '-01T12:00:00'))
    return format(d, 'yyyy-MM-dd')
  }, [monthValue])

  const preview = useMemo(() => {
    return calculateGoalPayment(remainingAmount, targetDateIso, frequency)
  }, [remainingAmount, targetDateIso, frequency])

  const monthlyIncomeBase = useMemo(() => {
    return incomeSources
      .filter((s) => s.isRecurring)
      .reduce((sum, s) => {
        let perMonth = s.amount
        if (s.recurringFrequency === 'weekly') perMonth = s.amount * 4.33
        else if (s.recurringFrequency === 'biweekly') perMonth = s.amount * 2.17
        const c = tryConvertCurrency(perMonth, s.currency, settings.baseCurrency, exchangeRates)
        return sum + (c ?? perMonth)
      }, 0)
  }, [exchangeRates, incomeSources, settings.baseCurrency])

  const incomeNote = useMemo(() => {
    if (monthlyIncomeBase <= 0 || preview.amountPerPeriod <= 0) return null
    const payBase = tryConvertCurrency(
      preview.amountPerPeriod,
      currency as Currency,
      settings.baseCurrency,
      exchangeRates
    )
    if (payBase === null) return null
    const pct = (payBase / monthlyIncomeBase) * 100
    if (pct > 30) {
      return t.addDebt.goalIncomeWarning(pct.toFixed(0))
    }
    return null
  }, [currency, exchangeRates, monthlyIncomeBase, preview.amountPerPeriod, settings.baseCurrency, t.addDebt])

  const handleSave = () => {
    onSave(
      {
        targetDate: targetDateIso,
        paymentFrequency: frequency,
        calculatedAmount: preview.amountPerPeriod,
      },
      remind
    )
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]">
      <div className="p-6 max-h-[85vh] overflow-y-auto">
        <ModalSheetHeader title={t.addDebt.goalSheetTitle} onClose={onClose} />
        <p className="text-sm text-[var(--color-brand-text-muted)] mt-1 mb-4">
          {debtTitle} —{' '}
          <span className="font-mono-numbers text-white">
            {formatCurrency(remainingAmount, currency)}
          </span>
        </p>
        <div className="space-y-4">
          <div className="max-w-[200px]">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.goalClearBy}</Label>
            <Input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
            />
          </div>
          <div className="max-w-[180px]">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.goalPaying}</Label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as GoalFreq)}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            >
              <option value="weekly">{t.addDebt.goalFreqWeekly}</option>
              <option value="monthly">{t.addDebt.goalFreqMonthly}</option>
              <option value="quarterly">{t.addDebt.goalFreqQuarterly}</option>
              <option value="annually">{t.addDebt.goalFreqAnnually}</option>
            </select>
          </div>
          <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-4 space-y-1">
            <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.goalYouNeed}</p>
            <p className="text-lg font-mono-numbers text-white">
              {formatCurrency(preview.amountPerPeriod, currency as Currency)}
              <span className="text-sm text-[var(--color-brand-text-muted)]">
                {frequency === 'weekly'
                  ? t.addDebt.goalSuffixWeekly
                  : frequency === 'monthly'
                    ? t.addDebt.goalSuffixMonthly
                    : frequency === 'quarterly'
                      ? t.addDebt.goalSuffixQuarterly
                      : t.addDebt.goalSuffixAnnually}
              </span>
            </p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">
              {t.addDebt.goalPaymentsCount(preview.totalPeriods)}
            </p>
          </div>
          {incomeNote ? (
            <p className="text-xs text-[var(--color-brand-amber)]">{incomeNote}</p>
          ) : null}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-brand-text-secondary)]">
            <input
              type="checkbox"
              checked={remind}
              onChange={(e) => setRemind(e.target.checked)}
              className="rounded border-[var(--color-brand-border)]"
            />
            {t.addDebt.goalRemindCheckbox}
          </label>
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
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
            >
              {t.addDebt.goalSetButton}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
