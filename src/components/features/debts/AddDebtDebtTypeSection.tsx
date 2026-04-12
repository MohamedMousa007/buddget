'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  interestFree: boolean
  setInterestFree: (v: boolean) => void
  relationship: string
  setRelationship: (v: string) => void
  direction: 'i_owe' | 'they_owe'
  setDirection: (v: 'i_owe' | 'they_owe') => void
  creditor: string
  setCreditor: (v: string) => void
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
  interestFree,
  setInterestFree,
  relationship,
  setRelationship,
  direction,
  setDirection,
  creditor,
  setCreditor,
}: AddDebtDebtTypeSectionProps) {
  const t = useT()

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.debtTypeLabel}</Label>
        <div className="mt-2 grid grid-cols-1 gap-2">
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
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                debtType === value
                  ? 'border-[var(--color-brand-red)] bg-[var(--color-brand-red)]/10 text-white'
                  : 'border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {debtType === 'personal' ? (
        <>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelRelationship}</Label>
            <Input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
            />
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelDirection}</Label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'i_owe' | 'they_owe')}
              className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
            >
              <option value="i_owe">{t.addDebt.directionIOwe}</option>
              <option value="they_owe">{t.addDebt.directionTheyOwe}</option>
            </select>
          </div>
        </>
      ) : null}

      {debtType === 'installment' ? (
        <>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelItemName}</Label>
            <Input
              value={installmentItemName}
              onChange={(e) => setInstallmentItemName(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
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
                className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelInstallmentFreq}</Label>
              <select
                value={installmentFrequency}
                onChange={(e) =>
                  setInstallmentFrequency(e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'annually')
                }
                className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
              >
                <option value="weekly">{t.addDebt.freqWeekly}</option>
                <option value="monthly">{t.addDebt.freqMonthly}</option>
                <option value="quarterly">{t.addDebt.freqQuarterly}</option>
                <option value="annually">{t.addDebt.freqAnnually}</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelStartDate}</Label>
            <Input
              type="date"
              value={installmentStartDate}
              onChange={(e) => setInstallmentStartDate(e.target.value)}
              className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelInterestFree}</Label>
            <Switch checked={interestFree} onCheckedChange={setInterestFree} />
          </div>
        </>
      ) : null}

      {debtType === 'general' ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.labelCreditor}</Label>
          <Input
            value={creditor}
            onChange={(e) => setCreditor(e.target.value)}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
          />
        </div>
      ) : null}
    </div>
  )
}
