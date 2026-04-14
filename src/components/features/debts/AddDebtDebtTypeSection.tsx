'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DebtKind } from '@/lib/store/types'
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
  relationship,
  setRelationship,
  direction,
  setDirection,
  creditor,
  setCreditor,
  hidePersonalDirection,
}: AddDebtDebtTypeSectionProps) {
  const t = useT()

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
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'i_owe' | 'they_owe')}
                className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              >
                <option value="i_owe">{t.addDebt.directionIOwe}</option>
                <option value="they_owe">{t.addDebt.directionTheyOwe}</option>
              </select>
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
              <select
                value={installmentFrequency}
                onChange={(e) =>
                  setInstallmentFrequency(e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'annually')
                }
                className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-sm"
              >
                <option value="weekly">{t.addDebt.freqWeekly}</option>
                <option value="monthly">{t.addDebt.freqMonthly}</option>
                <option value="quarterly">{t.addDebt.freqQuarterly}</option>
                <option value="annually">{t.addDebt.freqAnnually}</option>
              </select>
            </div>
          </div>
          <div className="max-w-[180px]">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelStartDate}</Label>
            <Input
              type="date"
              value={installmentStartDate}
              onChange={(e) => setInstallmentStartDate(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]"
            />
          </div>
        </>
      ) : null}

      {debtType === 'general' ? (
        <div className="max-w-[220px]">
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
