'use client'

import { useMemo } from 'react'
import { useAutoStartTour } from '@/hooks/useTutorial'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { GoalCategoryPicker } from '@/components/features/goals/GoalCategoryPicker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { useAddGoalForm } from '@/hooks/useAddGoalForm'
import type { Goal } from '@/lib/store/types'
import type { Dictionary } from '@/lib/i18n/types'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type AddGoalSheetProps = {
  open: boolean
  onClose: () => void
  editingGoal: Goal | null
}

const inputClass =
  'rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]'

type InnerProps = {
  editingGoal: Goal | null
  onClose: () => void
  title: string
  selectClass: string
  t: Dictionary
}

/**
 * Remount when `editingGoal` identity changes so `useAddGoalForm` initializes from props (no effect sync).
 */
function AddGoalSheetForm({ editingGoal, onClose, title, selectClass, t }: InnerProps) {
  const form = useAddGoalForm(editingGoal, onClose)

  return (
    <>
      <ModalSheetHeader title={title} onClose={onClose} />
      <div className="space-y-4 px-6 pb-6">
        {form.step === 1 && !editingGoal ? (
          <>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.category}</Label>
              <div className="mt-2">
                <GoalCategoryPicker value={form.category} onChange={form.pickCategory} labels={t.goals} />
              </div>
            </div>
            <button
              type="button"
              className="w-full py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              onClick={() => form.setStep(2)}
            >
              {t.goals.nextStep}
            </button>
          </>
        ) : (
          <>
            <div data-tutorial-id="goal-modal:name">
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.goalName}</Label>
              <Input
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                className={cn('mt-1', inputClass)}
              />
            </div>
            {form.category !== 'spending_control' ? (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.targetAmount}</Label>
                <Input
                  type="number"
                  value={form.targetAmount}
                  onChange={(e) => form.setTargetAmount(e.target.value)}
                  className={cn('mt-1', inputClass)}
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.monthlyLimit}</Label>
                <Input
                  type="number"
                  value={form.monthlySpendingLimit}
                  onChange={(e) => form.setMonthlySpendingLimit(e.target.value)}
                  className={cn('mt-1', inputClass)}
                />
              </div>
            )}
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.currency}</Label>
              <div className="mt-1">
                <FiatCurrencySelect value={form.currency} onChange={form.setCurrency} className={selectClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.targetDate}</Label>
                <Input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => form.setTargetDate(e.target.value)}
                  className={cn('mt-1', inputClass)}
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">
                  {t.goals.monthlyContribution}
                </Label>
                <Input
                  type="number"
                  value={form.monthlyContribution}
                  onChange={(e) => form.setMonthlyContribution(e.target.value)}
                  className={cn('mt-1', inputClass)}
                />
              </div>
            </div>
            {form.category === 'debt_freedom' ? (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.linkedDebts}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.activeDebts.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => form.toggleDebtLink(d.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs border',
                        form.linkedDebtIds.includes(d.id)
                          ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/15'
                          : 'border-[var(--color-brand-border)]'
                      )}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.linkedAccounts}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.savingsOptions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => form.toggleSavingsLink(a.id)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs border max-w-full truncate',
                        form.linkedSavingsAccountIds.includes(a.id)
                          ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/15'
                          : 'border-[var(--color-brand-border)]'
                      )}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.createAccountHint}</Label>
                  <Input
                    value={form.newAccountName}
                    onChange={(e) => form.setNewAccountName(e.target.value)}
                    placeholder={t.goals.createAccountPlaceholder}
                    className={cn('mt-1', inputClass)}
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.manualProgress}</Label>
              <Input
                type="number"
                value={form.manualCurrentAmount}
                onChange={(e) => form.setManualCurrentAmount(e.target.value)}
                className={cn('mt-1', inputClass)}
              />
              <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{t.goals.manualProgressHint}</p>
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.notes}</Label>
              <textarea
                value={form.notes}
                onChange={(e) => form.setNotes(e.target.value)}
                rows={2}
                className={cn('mt-1 w-full rounded-xl px-3 py-2 text-sm', inputClass)}
              />
            </div>
            <div className="flex gap-2">
              {!editingGoal ? (
                <button
                  type="button"
                  onClick={() => form.setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)]"
                >
                  {t.common.back}
                </button>
              ) : null}
              <button
                type="button"
                onClick={form.submit}
                data-tutorial-id="goal-modal:save"
                className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors"
              >
                {t.common.save}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/**
 * Two-step add/edit goal sheet: category grid then details (links, amounts, notes).
 */
export function AddGoalSheet({ open, onClose, editingGoal }: AddGoalSheetProps) {
  const t = useT()
  const selectClass = useMemo(
    () =>
      cn(
        'w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-[var(--color-brand-text-primary)]'
      ),
    []
  )

  useAutoStartTour('addGoalTour', open && !editingGoal)

  if (!open) return null

  const title = editingGoal ? t.goals.editGoal : t.goals.addGoal

  return (
    <ModalShell open={open} onBackdropClick={onClose} dragToClose>
      <AddGoalSheetForm
        key={editingGoal?.id ?? 'new'}
        editingGoal={editingGoal}
        onClose={onClose}
        title={title}
        selectClass={selectClass}
        t={t}
      />
    </ModalShell>
  )
}
