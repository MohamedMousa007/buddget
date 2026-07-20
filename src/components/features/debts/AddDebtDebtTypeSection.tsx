'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { DebtKind, InstallmentProvider } from '@/lib/store/types'
import { InstallmentProviderPickerSheet } from '@/components/features/debts/redesign/InstallmentProviderPickerSheet'
import { ProviderBadge } from '@/components/features/debts/redesign/ProviderBadge'
import { coarseProvider } from '@/lib/constants/installmentProviders'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
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
  installmentProviderName: string
  setInstallmentProviderName: (v: string) => void
  installmentProviderSlug?: string
  setInstallmentProviderSlug: (v: string | undefined) => void
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
  installmentProviderName,
  setInstallmentProviderName,
  installmentProviderSlug,
  setInstallmentProviderSlug,
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
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const [providerSheetOpen, setProviderSheetOpen] = useState(false)

  const providerLabel =
    installmentProvider === 'credit_card'
      ? (creditCardDebts.find((c) => c.id === linkedCreditCardDebtId)?.name ?? 'Credit card')
      : installmentProviderName || t.addDebt.installmentProviderLabel

  const directionItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: 'i_owe', label: t.addDebt.directionIOwe },
      { value: 'they_owe', label: t.addDebt.directionTheyOwe },
    ],
    [t.addDebt],
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
          {/* Provider field → opens the 2-col brand-grid picker sheet (handoff §7) */}
          <div>
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebt.installmentProviderLabel}</Label>
            <button
              type="button"
              onClick={() => setProviderSheetOpen(true)}
              className="mt-1 flex h-12 w-full items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-start"
            >
              {installmentProvider === 'credit_card' ? (
                <span className="flex h-7 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#8A5CF6]/22 text-[11px] font-extrabold text-[#8A5CF6]">CC</span>
              ) : installmentProviderName ? (
                <ProviderBadge slug={installmentProviderSlug} name={installmentProviderName} size={28} />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{providerLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
            </button>
          </div>
          <InstallmentProviderPickerSheet
            open={providerSheetOpen}
            valueSlug={installmentProviderSlug}
            valueCardId={installmentProvider === 'credit_card' ? linkedCreditCardDebtId : undefined}
            creditCardDebts={creditCardDebts}
            onPickBrand={(slug, name) => {
              setInstallmentProvider(coarseProvider(slug))
              setInstallmentProviderName(name)
              setInstallmentProviderSlug(slug)
              setLinkedCreditCardDebtId('')
            }}
            onPickCard={(cardId, name) => {
              setInstallmentProvider('credit_card')
              setInstallmentProviderName(name)
              setInstallmentProviderSlug(undefined)
              setLinkedCreditCardDebtId(cardId)
            }}
            onCustom={(name) => {
              setInstallmentProvider('other')
              setInstallmentProviderName(name)
              setInstallmentProviderSlug(undefined)
              setLinkedCreditCardDebtId('')
            }}
            onAddCreditCard={() => setActiveModal('addCreditCard')}
            onClose={() => setProviderSheetOpen(false)}
          />
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
              <AmountField
                mode="integer"
                value={installmentCount}
                onChange={setInstallmentCount}
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
