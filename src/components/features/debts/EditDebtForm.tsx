'use client'

import { Fragment, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { Debt, DebtCurrency, GoldKarat } from '@/lib/store/types'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useEditDebtForm } from '@/hooks/useEditDebtForm'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useT } from '@/lib/i18n'
import { DebtGoalSheet } from '@/components/features/debts/DebtGoalSheet'

export function EditDebtForm({
  debt,
  isOpen,
  onClose,
}: {
  debt: Debt
  isOpen: boolean
  onClose: () => void
}) {
  useEscapeClose(isOpen, onClose)
  const f = useEditDebtForm(debt, isOpen)
  const settings = useFinanceStore((s) => s.settings)
  const t = useT()

  const paidOff = f.paidOff
  const goalCurrency = debt.isGold ? 'XAU' : String(debt.currency)
  const karatItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: '24', label: t.goldPurity.k24 },
      { value: '22', label: t.goldPurity.k22 },
      { value: '21', label: t.goldPurity.k21 },
      { value: '18', label: t.goldPurity.k18 },
    ],
    [t.goldPurity],
  )

  return (
    <Fragment>
      <div className="p-5">
        <ModalSheetHeader title={t.debts.editSheetTitle} onClose={onClose} />

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelName}</Label>
            <Input
              value={f.name}
              onChange={(e) => f.setName(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelPerson}</Label>
            <Input
              value={f.person}
              onChange={(e) => f.setPerson(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDescription}</Label>
            <Input
              placeholder={t.addDebt.placeholderDescription}
              value={f.description}
              onChange={(e) => f.setDescription(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGold}</Label>
            <Switch
              checked={f.isGold}
              onCheckedChange={(val) => {
                f.setIsGold(val)
                if (val) f.setCurrency('XAU')
                else f.setCurrency(settings.baseCurrency as DebtCurrency)
              }}
            />
          </div>

          {!f.isGold && (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCurrency}</Label>
              <DebtFiatCurrencySelect
                value={f.currency}
                onChange={f.setCurrency}
                className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              />
            </div>
          )}

          {f.isGold && (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGoldPurity}</Label>
              <SelectField
                value={String(f.goldKarat)}
                onChange={(v) => f.setGoldKarat(parseInt(v, 10) as GoldKarat)}
                items={karatItems}
                className="mt-1"
                aria-label={t.addDebt.labelGoldPurity}
              />
            </div>
          )}

          {!paidOff ? (
            <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/25 p-3 space-y-2">
              <p className="text-xs font-medium text-[var(--color-brand-text-secondary)]">{t.debts.goalSectionTitle}</p>
              {debt.goal ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => f.setGoalSheetOpen(true)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-brand-red)]/15 text-[var(--color-brand-red)] hover:bg-[var(--color-brand-red)]/25 transition-colors"
                  >
                    {t.debts.goalEditButton}
                  </button>
                  <button
                    type="button"
                    onClick={f.handleRemoveGoal}
                    className="text-sm px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)] transition-colors"
                  >
                    {t.addDebt.goalChipRemoveAria}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => f.setGoalSheetOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/25 transition-colors"
                >
                  {t.addDebt.goalTrigger}
                </button>
              )}
            </div>
          ) : null}

          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelNotes}</Label>
            <Textarea
              value={f.notes}
              onChange={(e) => f.setNotes(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-16"
            />
          </div>

          <p className="text-xs text-[var(--color-brand-text-muted)]">
            Starting amount ({debt.isGold ? `${debt.startingBalance}g` : `${debt.currency} ${debt.startingBalance}`})
            can&apos;t be changed — delete and recreate the balance if needed.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => f.handleDelete(onClose)}
              className="py-3 px-4 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => f.handleSave(onClose)}
              disabled={!f.name || !f.person}
              className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {t.common.save}
            </button>
          </div>
        </div>
      </div>

      <DebtGoalSheet
        open={f.goalSheetOpen}
        onClose={() => f.setGoalSheetOpen(false)}
        debtTitle={debt.name}
        remainingAmount={Math.max(0, f.remainingForGoal)}
        currency={goalCurrency}
        initialGoal={debt.goal}
        initialRemindRecurring={Boolean(f.recurringForDebt)}
        onSave={f.handleGoalSave}
      />
    </Fragment>
  )
}
