'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { useT } from '@/lib/i18n'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'
import type {
  Currency,
  PaymentMethodType,
} from '@/lib/store/types'
import type { PaymentMethodDraft } from '@/lib/onboarding/journeyTypes'

/**
 * Inline editor for a single PaymentMethodDraft. Minimal fields — the
 * apply playbook in PR2 calls `addPaymentMethod(draft)` and the store
 * fills in the rest (id, createdAt). For credit cards the store also
 * auto-creates a linked Debt row via existing logic at
 * `useFinanceStore.ts:254-288` — we surface an opening-balance-owed
 * input here that the playbook passes to the spawned Debt.
 */
export interface PaymentMethodRowEditorProps {
  initial?: PaymentMethodDraft
  defaultCurrency: Currency
  onSave: (row: PaymentMethodDraft) => void
  onCancel: () => void
}

const TYPE_OPTIONS: Array<{ value: PaymentMethodType; labelKey: string }> = [
  { value: 'cash', labelKey: 'onboarding.journey.pmTypes.cash' },
  { value: 'bank_transfer', labelKey: 'onboarding.journey.pmTypes.bank_transfer' },
  { value: 'card_debit', labelKey: 'onboarding.journey.pmTypes.card_debit' },
  { value: 'card_credit', labelKey: 'onboarding.journey.pmTypes.card_credit' },
  { value: 'other', labelKey: 'onboarding.journey.pmTypes.other' },
]

export function PaymentMethodRowEditor({
  initial,
  defaultCurrency,
  onSave,
  onCancel,
}: PaymentMethodRowEditorProps) {
  const t = useT()

  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(initial?.type ?? 'bank_transfer')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency)
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false)
  const [openingBalanceOwed, setOpeningBalanceOwed] = useState(
    initial?.openingBalanceOwed != null ? String(initial.openingBalanceOwed) : '',
  )

  const typeItems: ReadonlyArray<SelectFieldOption> = TYPE_OPTIONS.map((o) => ({
    value: o.value,
    label: readI18n(t, o.labelKey),
  }))

  const isCredit = type === 'card_credit'
  const canSave = name.trim().length > 0

  const save = () => {
    if (!canSave) return
    const draft: PaymentMethodDraft = {
      clientDraftId: initial?.clientDraftId ?? crypto.randomUUID(),
      name: name.trim(),
      type,
      currency,
      isDefault,
      ...(isCredit && openingBalanceOwed.trim() !== ''
        ? { openingBalanceOwed: Math.max(0, parseFloat(openingBalanceOwed)) }
        : {}),
    }
    onSave(draft)
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">
          {readI18n(t, 'onboarding.journey.pmEditor.nameLabel')}
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={readI18n(t, 'onboarding.journey.pmEditor.namePlaceholder')}
          autoFocus
          className="mt-1 h-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.pmEditor.typeLabel')}
          </Label>
          <div className="mt-1">
            <SelectField
              value={type}
              onChange={(v) => setType(v as PaymentMethodType)}
              items={typeItems}
              aria-label={readI18n(t, 'onboarding.journey.pmEditor.typeLabel')}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.pmEditor.currencyLabel')}
          </Label>
          <div className="mt-1">
            <FiatCurrencySelect
              value={currency}
              onChange={(v) => setCurrency(v)}
            />
          </div>
        </div>
      </div>

      {isCredit ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.pmEditor.openingOwedLabel')}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            value={openingBalanceOwed}
            onChange={(e) => setOpeningBalanceOwed(e.target.value)}
            placeholder="0.00"
            className="mt-1 h-10 font-mono-numbers"
          />
          <p className="mt-1 text-[11px] text-[var(--color-brand-text-muted)]">
            {readI18n(t, 'onboarding.journey.pmEditor.openingOwedHint')}
          </p>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-[var(--color-brand-text-secondary)]">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-brand-red)]"
        />
        <span>{readI18n(t, 'onboarding.journey.pmEditor.defaultCheck')}</span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-lg text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          {t.common.cancel ?? 'Cancel'}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.common.save ?? 'Save'}
        </button>
      </div>
    </div>
  )
}
