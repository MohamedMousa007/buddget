'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DebtFiatCurrencySelect } from '@/components/ui/DebtFiatCurrencySelect'
import { AddDebtDebtTypeSection } from '@/components/features/debts/AddDebtDebtTypeSection'
import type { AppSettings, DebtCurrency, DebtGoal, DebtKind, GoldKarat } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

export interface AddDebtNewFormProps {
  settings: AppSettings
  debtType: DebtKind
  setDebtType: (k: DebtKind) => void
  name: string
  setName: (v: string) => void
  person: string
  setPerson: (v: string) => void
  description: string
  setDescription: (v: string) => void
  isGold: boolean
  setIsGold: (v: boolean) => void
  startingBalance: string
  setStartingBalance: (v: string) => void
  currency: DebtCurrency
  setCurrency: (v: DebtCurrency) => void
  goldKarat: GoldKarat
  setGoldKarat: (v: GoldKarat) => void
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
  installmentPreview: number | null
  goalDraft: DebtGoal | null
  onOpenGoal: () => void
  onClearGoal: () => void
  onCancel: () => void
  onSubmit: () => void
  canSubmit: boolean
}

/**
 * Fields for creating a new debt (fiat or gold) with debt-type sections.
 */
export function AddDebtNewForm({
  settings,
  debtType,
  setDebtType,
  name,
  setName,
  person,
  setPerson,
  description,
  setDescription,
  isGold,
  setIsGold,
  startingBalance,
  setStartingBalance,
  currency,
  setCurrency,
  goldKarat,
  setGoldKarat,
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
  installmentPreview,
  goalDraft,
  onOpenGoal,
  onClearGoal,
  onCancel,
  onSubmit,
  canSubmit,
}: AddDebtNewFormProps) {
  const t = useT()
  const showGold = debtType !== 'installment'

  return (
    <div className="space-y-4">
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
      />

      {debtType !== 'installment' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelName}</Label>
            <Input
              placeholder={t.addDebt.placeholderName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelPerson}</Label>
            <Input
              placeholder={t.addDebt.placeholderPerson}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
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
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
      </div>

      {showGold ? (
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelGold}</Label>
          <Switch
            checked={isGold}
            onCheckedChange={(val) => {
              setIsGold(val)
              if (val) setCurrency('XAU')
              else setCurrency(settings.baseCurrency as DebtCurrency)
            }}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {isGold ? t.addDebt.labelTotalGrams : t.addDebt.labelTotalAmount}
          </Label>
          <Input
            type="number"
            step="0.01"
            placeholder={t.addDebt.placeholderAmount}
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
        {!isGold ? (
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCurrency}</Label>
            <DebtFiatCurrencySelect
              value={currency}
              onChange={setCurrency}
              className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
            />
          </div>
        ) : (
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
        )}
      </div>

      {debtType === 'installment' && installmentPreview !== null ? (
        <p className="text-xs text-[var(--color-brand-text-secondary)] font-mono-numbers">
          ≈ {formatCurrency(installmentPreview, currency)} / {t.addDebt.freqMonthly.toLowerCase()}
        </p>
      ) : null}

      <div className="space-y-2">
        {goalDraft ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm">
            <button type="button" onClick={onOpenGoal} className="min-w-0 flex-1 text-left">
              <span>🎯</span>{' '}
              <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                {formatCurrency(goalDraft.calculatedAmount, currency)}/
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

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {t.addDebt.buttonSubmit}
        </button>
      </div>
    </div>
  )
}
