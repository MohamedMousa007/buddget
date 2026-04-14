'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddDebtDebtTypeSection } from '@/components/features/debts/AddDebtDebtTypeSection'
import { DebtReceivedViaPills } from '@/components/features/debts/DebtReceivedViaPills'
import type { DebtCurrency, DebtGoal, DebtKind, DebtReceivedVia, GoldKarat } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

export type IncomeDebtEmbedProps = {
  incomeAmount: number
  incomeCurrency: DebtCurrency
  debtType: DebtKind
  setDebtType: (k: DebtKind) => void
  person: string
  setPerson: (v: string) => void
  description: string
  setDescription: (v: string) => void
  relationship: string
  setRelationship: (v: string) => void
  direction: 'i_owe' | 'they_owe'
  setDirection: (v: 'i_owe' | 'they_owe') => void
  creditor: string
  setCreditor: (v: string) => void
  installmentItemName: string
  setInstallmentItemName: (v: string) => void
  installmentCount: string
  setInstallmentCount: (v: string) => void
  installmentFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  setInstallmentFrequency: (v: 'weekly' | 'monthly' | 'quarterly' | 'annually') => void
  installmentStartDate: string
  setInstallmentStartDate: (v: string) => void
  interestFree: boolean
  setInterestFree: (v: boolean) => void
  receivedVia: DebtReceivedVia
  onReceivedViaChange: (v: DebtReceivedVia) => void
  goldKarat: GoldKarat
  setGoldKarat: (v: GoldKarat) => void
  installmentPreview: number | null
  goalDraft: DebtGoal | null
  onOpenGoal: () => void
  onClearGoal: () => void
}

/**
 * Debt sub-form when adding income as borrowed money: mirrors add-debt fields without duplicating amount (uses income total).
 */
export function IncomeDebtEmbed({
  incomeAmount,
  incomeCurrency,
  debtType,
  setDebtType,
  person,
  setPerson,
  description,
  setDescription,
  relationship,
  setRelationship,
  direction,
  setDirection,
  creditor,
  setCreditor,
  installmentItemName,
  setInstallmentItemName,
  installmentCount,
  setInstallmentCount,
  installmentFrequency,
  setInstallmentFrequency,
  installmentStartDate,
  setInstallmentStartDate,
  interestFree,
  setInterestFree,
  receivedVia,
  onReceivedViaChange,
  goldKarat,
  setGoldKarat,
  installmentPreview,
  goalDraft,
  onOpenGoal,
  onClearGoal,
}: IncomeDebtEmbedProps) {
  const t = useT()
  const isGold = receivedVia === 'gold'
  const showGold = debtType !== 'installment'

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 p-3">
      <p className="text-[10px] text-[var(--color-brand-text-muted)]">
        {t.addIncome.debtUsesIncomeAmount}{' '}
        <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
          {formatCurrency(incomeAmount, incomeCurrency)}
        </span>
      </p>

      <AddDebtDebtTypeSection
        debtType={debtType}
        setDebtType={setDebtType}
        installmentItemName={installmentItemName}
        setInstallmentItemName={setInstallmentItemName}
        installmentCount={installmentCount}
        setInstallmentCount={setInstallmentCount}
        installmentFrequency={installmentFrequency}
        setInstallmentFrequency={setInstallmentFrequency}
        installmentStartDate={installmentStartDate}
        setInstallmentStartDate={setInstallmentStartDate}
        relationship={relationship}
        setRelationship={setRelationship}
        direction={direction}
        setDirection={setDirection}
        creditor={creditor}
        setCreditor={setCreditor}
        hidePersonalDirection
      />

      {debtType !== 'installment' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.income.debtPersonLabel}</Label>
            <Input
              placeholder={t.income.debtPersonPlaceholder}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
            />
          </div>
        </div>
      ) : null}

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDescription}</Label>
        <Input
          placeholder={t.addDebt.placeholderDescription}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
        />
      </div>

      {debtType === 'installment' ? (
        <label className="flex items-center gap-2 text-xs text-[var(--color-brand-text-secondary)]">
          <input
            type="checkbox"
            checked={interestFree}
            onChange={(e) => setInterestFree(e.target.checked)}
            className="rounded border-[var(--color-brand-border)]"
          />
          {t.addDebt.labelInterestFree}
        </label>
      ) : null}

      {showGold ? <DebtReceivedViaPills value={receivedVia} onChange={onReceivedViaChange} /> : null}

      {isGold ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGoldPurity}</Label>
          <select
            value={goldKarat}
            onChange={(e) => setGoldKarat(parseInt(e.target.value, 10) as GoldKarat)}
            className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
          >
            <option value="24">{t.goldPurity.k24}</option>
            <option value="22">{t.goldPurity.k22}</option>
            <option value="21">{t.goldPurity.k21}</option>
            <option value="18">{t.goldPurity.k18}</option>
          </select>
        </div>
      ) : null}

      {debtType === 'installment' && installmentPreview !== null ? (
        <p className="text-xs text-[var(--color-brand-text-secondary)] font-mono-numbers">
          ≈ {formatCurrency(installmentPreview, incomeCurrency)} / {t.addDebt.freqMonthly.toLowerCase()}
        </p>
      ) : null}

      <div className="space-y-2">
        {goalDraft ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm">
            <button type="button" onClick={onOpenGoal} className="min-w-0 flex-1 text-left">
              <span>🎯</span>{' '}
              <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                {formatCurrency(goalDraft.calculatedAmount, incomeCurrency)}/
                {goalDraft.paymentFrequency === 'monthly' ? 'mo' : goalDraft.paymentFrequency} until{' '}
                {goalDraft.targetDate.slice(0, 7)}
              </span>
            </button>
            <button
              type="button"
              onClick={onClearGoal}
              className="text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
              aria-label={t.addDebt.goalChipRemoveAria}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenGoal}
            className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-brand-green)]/15 text-[var(--color-brand-green)] hover:bg-[var(--color-brand-green)]/25 transition-colors"
          >
            {t.addDebt.goalTrigger}
          </button>
        )}
      </div>
    </div>
  )
}
