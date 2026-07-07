'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { DebtKind, InstallmentProvider } from '@/lib/store/types'
import { InstallmentProviderPicker } from '@/components/features/debts/InstallmentProviderPicker'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { useT } from '@/lib/i18n'

interface AddDebtDebtTypeSectionProps {
  debtType: DebtKind
  setDebtType: (k: DebtKind) => void
  /** Installment item label */
  installmentItemName: string
  setInstallmentItemName: (v: string) => void
  installmentCount: string
  setInstallmentCount: (v: string) => void
  installmentFrequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  setInstallmentFrequency: (v: 'weekly' | 'monthly' | 'quarterly' | 'annually') => void
  installmentStartDate: string
  setInstallmentStartDate: (v: string) => void
  installmentProvider: InstallmentProvider
  setInstallmentProvider: (k: InstallmentProvider) => void
  linkedCreditCardDebtId: string
  setLinkedCreditCardDebtId: (id: string) => void
  creditCardDebts: { id: string; name: string }[]
  relationship: string
  setRelationship: (v: string) => void
  direction: 'i_owe' | 'they_owe'
  setDirection: (v: 'i_owe' | 'they_owe') => void
  creditor: string
  setCreditor: (v: string) => void
  /** Hide direction selector (e.g. income-from-debt flow is always i_owe). */
  hidePersonalDirection?: boolean
}

/**
 * Debt kind selector and conditional fields (personal / installment / general).
 */
export function AddDebtDebtTypeSection({
  debtType,
  setDebtType,
  installmentItemName,
  setInstallmentItemName,
  installmentCount,
  setInstallmentCount,
  installmentFrequency,
  setInstallmentFrequency,
  installmentStartDate,
  setInstallmentStartDate,
  installmentProvider,
  setInstallmentProvider,
  linkedCreditCardDebtId,
  setLinkedCreditCardDebtId,
  creditCardDebts,
  relationship,
  setRelationship,
  direction,
  setDirection,
  creditor,
  setCreditor,
  hidePersonalDirection,
}: AddDebtDebtTypeSectionProps) {
  const t = useT()

  const directionItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: 'i_owe', label: t.addDebt.directionIOwe },
      { value: 'they_owe', label: t.addDebt.directionTheyOwe },
    ],
    [t.addDebt],
  )
  const creditCardItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: '', label: t.addDebt.whichCreditCardPlaceholder },
      ...creditCardDebts.map((d) => ({ value: d.id, label: d.name })),
    ],
    [creditCardDebts, t.addDebt.whichCreditCardPlaceholder],
  )
  const installmentFreqItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: 'weekly', label: t.addDebt.freqWeekly },
      { value: 'monthly', label: t.addDebt.freqMonthly },
      { value: 'quarterly', label: t.addDebt.freqQuarterly },
      { value: 'annually', label: t.addDebt.freqAnnually },
    ],
    [t.addDebt],
  )

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.debtTypeLabel}</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ['personal', t.addDebt.debtTypePersonal],
              ['installment', t.addDebt.debtTypeInstallment],
              ['general', t.addDebt.debtTypeGeneral],
              ['credit_card', t.addDebt.debtTypeCreditCard],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDebtType(value)}
              className={`rounded-lg border px-3 py-1.5 text-sm text-center transition-colors ${
                debtType === value
                  ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-[var(--color-brand-text-primary)]'
                  : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {debtType === 'personal' ? (
        <div
          className={
            hidePersonalDirection ? 'space-y-3' : 'grid grid-cols-2 gap-3'
          }
        >
          {!hidePersonalDirection ? (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDirection}</Label>
              <SelectField
                value={direction}
                onChange={(v) => setDirection(v as 'i_owe' | 'they_owe')}
                items={directionItems}
                className="mt-1"
                aria-label={t.addDebt.labelDirection}
              />
            </div>
          ) : null}
          <div className={hidePersonalDirection ? '' : ''}>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelRelationship}</Label>
            <Input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
            />
          </div>
        </div>
      ) : null}

      {debtType === 'installment' ? (
        <>
          <InstallmentProviderPicker value={installmentProvider} onChange={setInstallmentProvider} />
          {installmentProvider === 'credit_card' ? (
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.whichCreditCard}</Label>
              <SelectField
                value={linkedCreditCardDebtId}
                onChange={setLinkedCreditCardDebtId}
                items={creditCardItems}
                className="mt-1"
                aria-label={t.addDebt.whichCreditCard}
              />
            </div>
          ) : null}
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelItemName}</Label>
            <Input
              value={installmentItemName}
              onChange={(e) => setInstallmentItemName(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelInstallments}</Label>
              <Input
                type="number"
                min={1}
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelInstallmentFreq}</Label>
              <SelectField
                value={installmentFrequency}
                onChange={(v) =>
                  setInstallmentFrequency(v as 'weekly' | 'monthly' | 'quarterly' | 'annually')
                }
                items={installmentFreqItems}
                className="mt-1"
                aria-label={t.addDebt.labelInstallmentFreq}
              />
            </div>
          </div>
          <div className="max-w-44">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelStartDate}</Label>
            <DatePickerField value={installmentStartDate} onChange={setInstallmentStartDate} className="mt-1" />
          </div>
        </>
      ) : null}

      {debtType === 'general' ? (
        <div className="max-w-56">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCreditor}</Label>
          <Input
            value={creditor}
            onChange={(e) => setCreditor(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
          />
        </div>
      ) : null}
    </div>
  )
}
